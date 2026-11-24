/**
 * Script tải toàn bộ ảnh món ăn và nguyên liệu lên Cloudinary của người dùng (cxdeycol)
 * Sử dụng:
 *   node scripts/sync_to_cloudinary.js "CLOUDINARY_URL=cloudinary://<key>:<secret>@cxdeycol"
 * hoặc:
 *   CLOUDINARY_URL="cloudinary://..." node scripts/sync_to_cloudinary.js
 */
const { execSync } = require('child_process');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { resolveDishImage, resolveIngredientImage } = require('./upload_cloudinary_images');

let cloudinaryUrl = process.argv[2] || process.env.CLOUDINARY_URL || '';
if (cloudinaryUrl.startsWith('CLOUDINARY_URL=')) {
  cloudinaryUrl = cloudinaryUrl.replace('CLOUDINARY_URL=', '');
}

let cloudName = 'cxdeycol';
let apiKey = '';
let apiSecret = '';

if (cloudinaryUrl) {
  // Format: cloudinary://<api_key>:<api_secret>@<cloud_name>
  const match = cloudinaryUrl.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
  if (match) {
    apiKey = match[1].trim();
    apiSecret = match[2].trim();
    cloudName = match[3].trim();
  }
}

if (!apiKey || !apiSecret) {
  console.log('⚠️ Chưa tìm thấy API Key và API Secret hợp lệ.');
  console.log('Cách dùng: node scripts/sync_to_cloudinary.js "cloudinary://<api_key>:<api_secret>@cxdeycol"');
  process.exit(1);
}

console.log(`Đang kết nối Cloudinary: Cloud Name = ${cloudName}, API Key = ${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`);

async function uploadToCloudinary(imageUrl, publicId, folder) {
  return new Promise((resolve, reject) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(toSign).digest('hex');

    const postData = new URLSearchParams({
      file: imageUrl,
      public_id: publicId,
      folder: folder,
      timestamp: String(timestamp),
      api_key: apiKey,
      signature: signature,
    }).toString();

    const options = {
      hostname: 'api.cloudinary.com',
      port: 443,
      path: `/v1_1/${cloudName}/image/upload`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed.secure_url);
          } else {
            reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}: ${data}`));
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

(async () => {
  // Lấy danh sách món ăn từ DB
  const dishesJson = execSync(
    `docker exec -i kidmeal-test-postgres-1 psql -U kidmeal_test -d kidmeal_test_kiet_1793705569028 -t -A -c "SELECT json_agg(t) FROM (SELECT id, name FROM dishes ORDER BY id) t;"`
  ).toString().trim();

  // Lấy danh sách nguyên liệu từ DB
  const foodsJson = execSync(
    `docker exec -i kidmeal-test-postgres-1 psql -U kidmeal_test -d kidmeal_test_kiet_1793705569028 -t -A -c "SELECT json_agg(t) FROM (SELECT id, name FROM food_ingredients ORDER BY id) t;"`
  ).toString().trim();

  const dishes = JSON.parse(dishesJson || '[]');
  const foods = JSON.parse(foodsJson || '[]');

  console.log(`Bắt đầu đồng bộ ${dishes.length} món ăn và ${foods.length} nguyên liệu lên Cloudinary...`);

  let updatedDishes = 0;
  for (const dish of dishes) {
    try {
      const sourceUrl = resolveDishImage(dish.name);
      const publicId = `dish_${dish.id}_${slugify(dish.name)}`;
      const cloudUrl = await uploadToCloudinary(sourceUrl, publicId, 'kidmeal/dishes');
      execSync(
        `docker exec -i kidmeal-test-postgres-1 psql -U kidmeal_test -d kidmeal_test_kiet_1793705569028 -c "UPDATE dishes SET image_url = '${cloudUrl}', source_metadata = jsonb_set(COALESCE(source_metadata, '{}'::jsonb), '{imageUrl}', '\"${cloudUrl}\"'::jsonb) WHERE id = ${dish.id};"`
      );
      updatedDishes++;
      if (updatedDishes % 10 === 0) {
        console.log(`Đã tải lên Cloudinary ${updatedDishes}/${dishes.length} món ăn...`);
      }
    } catch (err) {
      console.error(`Lỗi tải món "${dish.name}":`, err.message);
    }
  }

  let updatedFoods = 0;
  for (const food of foods) {
    try {
      const sourceUrl = resolveIngredientImage(food.name);
      const publicId = `food_${food.id}_${slugify(food.name)}`;
      const cloudUrl = await uploadToCloudinary(sourceUrl, publicId, 'kidmeal/foods');
      execSync(
        `docker exec -i kidmeal-test-postgres-1 psql -U kidmeal_test -d kidmeal_test_kiet_1793705569028 -c "UPDATE food_ingredients SET image_url = '${cloudUrl}', source_metadata = jsonb_set(COALESCE(source_metadata, '{}'::jsonb), '{imageUrl}', '\"${cloudUrl}\"'::jsonb) WHERE id = ${food.id};"`
      );
      updatedFoods++;
      if (updatedFoods % 10 === 0) {
        console.log(`Đã tải lên Cloudinary ${updatedFoods}/${foods.length} nguyên liệu...`);
      }
    } catch (err) {
      console.error(`Lỗi tải nguyên liệu "${food.name}":`, err.message);
    }
  }

  console.log(`🎉 Hoàn tất đồng bộ Cloudinary! Đã cập nhật ${updatedDishes} món ăn và ${updatedFoods} nguyên liệu.`);
})();

