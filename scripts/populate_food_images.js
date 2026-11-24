/**
 * Script cập nhật hình ảnh trực quan cho toàn bộ 174 món ăn & 174 nguyên liệu
 * vào PostgreSQL (bảng dishes và food_ingredients)
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { resolveDishImage, resolveIngredientImage } = require('./upload_cloudinary_images');

// 1. Lấy danh sách món ăn từ DB
const dishesJson = execSync(
  `docker exec -i kidmeal-test-postgres-1 psql -U kidmeal_test -d kidmeal_test_kiet_1793705569028 -t -A -c "SELECT json_agg(t) FROM (SELECT id, name FROM dishes ORDER BY id) t;"`
).toString().trim();

// 2. Lấy danh sách nguyên liệu từ DB
const foodsJson = execSync(
  `docker exec -i kidmeal-test-postgres-1 psql -U kidmeal_test -d kidmeal_test_kiet_1793705569028 -t -A -c "SELECT json_agg(t) FROM (SELECT id, name FROM food_ingredients ORDER BY id) t;"`
).toString().trim();

const dishes = JSON.parse(dishesJson || '[]');
const foods = JSON.parse(foodsJson || '[]');

console.log(`Tìm thấy ${dishes.length} món ăn và ${foods.length} nguyên liệu.`);

let sqlStatements = [];

// Cập nhật dishes
for (const dish of dishes) {
  const imgUrl = resolveDishImage(dish.name);
  const escapedName = dish.name.replace(/'/g, "''");
  sqlStatements.push(
    `UPDATE dishes SET image_url = '${imgUrl}', source_metadata = jsonb_set(COALESCE(source_metadata, '{}'::jsonb), '{imageUrl}', '"${imgUrl}"'::jsonb) WHERE id = ${dish.id};`
  );
}

// Cập nhật food_ingredients
for (const food of foods) {
  const imgUrl = resolveIngredientImage(food.name);
  sqlStatements.push(
    `UPDATE food_ingredients SET image_url = '${imgUrl}', source_metadata = jsonb_set(COALESCE(source_metadata, '{}'::jsonb), '{imageUrl}', '"${imgUrl}"'::jsonb) WHERE id = ${food.id};`
  );
}

const sqlFile = path.join(__dirname, 'batch_update_images.sql');
fs.writeFileSync(sqlFile, sqlStatements.join('\n'), 'utf8');

console.log(`Đã tạo file SQL với ${sqlStatements.length} câu lệnh UPDATE.`);

// Thực thi file SQL trên container PostgreSQL
execSync(
  `docker exec -i kidmeal-test-postgres-1 psql -U kidmeal_test -d kidmeal_test_kiet_1793705569028 < "${sqlFile}"`
);

console.log('✅ Hoàn tất cập nhật hình ảnh cho toàn bộ Món ăn & Nguyên liệu trong CSDL!');

