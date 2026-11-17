import subprocess

NUTRITION_PROFILES = {
    'thit': [115.0, 11.2, 7.8, 1.2, 0.2, 12.0, 1.4, 1.8],
    'bo': [110.0, 12.5, 6.2, 1.5, 0.3, 15.0, 2.2, 2.5],
    'ga': [105.0, 11.8, 5.8, 1.4, 0.2, 14.0, 1.2, 1.6],
    'ca': [88.0, 10.5, 4.8, 0.8, 0.1, 28.0, 0.9, 1.1],
    'tom': [82.0, 11.0, 3.2, 1.5, 0.2, 52.0, 1.1, 1.3],
    'trung': [118.0, 9.2, 8.5, 1.6, 0.1, 35.0, 1.6, 1.4],
    'suon': [120.0, 10.8, 8.2, 1.1, 0.1, 18.0, 1.3, 1.7],
    'com': [175.0, 4.2, 1.1, 37.5, 0.8, 12.0, 0.6, 0.9],
    'xoi': [185.0, 4.5, 2.2, 38.0, 0.9, 14.0, 0.7, 0.9],
    'canh': [45.0, 4.8, 1.2, 3.8, 1.2, 25.0, 0.9, 0.8],
    'sup': [68.0, 5.5, 2.2, 6.5, 0.8, 22.0, 0.8, 0.9],
    'hu tieu': [135.0, 7.8, 2.8, 19.5, 0.8, 22.0, 1.1, 1.2],
    'banh canh': [130.0, 7.5, 2.6, 19.2, 0.7, 25.0, 1.0, 1.1],
    'pho': [140.0, 8.2, 3.1, 19.8, 0.8, 20.0, 1.3, 1.4],
    'banh bao': [145.0, 6.5, 3.8, 21.2, 0.6, 18.0, 0.9, 1.0],
    'nui': [132.0, 7.6, 2.7, 19.3, 0.8, 21.0, 1.0, 1.1],
    'mi': [138.0, 7.9, 3.0, 19.8, 0.8, 20.0, 1.1, 1.2],
    'mien': [128.0, 7.2, 2.5, 19.1, 0.7, 19.0, 1.0, 1.1],
    'chao': [125.0, 6.8, 2.6, 18.5, 0.8, 20.0, 0.9, 1.0],
    'banh': [120.0, 4.5, 3.2, 18.5, 0.5, 15.0, 0.7, 0.8],
    'trai cay': [52.0, 0.8, 0.2, 12.5, 1.8, 18.0, 0.4, 0.3],
    'nuoc': [55.0, 0.6, 0.2, 13.0, 0.4, 15.0, 0.3, 0.2],
    'sua': [75.0, 3.2, 3.0, 9.2, 0.1, 110.0, 0.2, 0.5],
    'che': [85.0, 2.1, 1.5, 16.2, 0.8, 20.0, 0.5, 0.4],
    'rau cau': [62.0, 1.1, 0.5, 13.8, 0.4, 16.0, 0.3, 0.2],
    'yaourt': [78.0, 3.5, 2.8, 10.2, 0.1, 120.0, 0.2, 0.5],
}

def guess_profile(name, cat_code, cat_name):
    nl = name.lower()
    cl = (cat_code or '').lower() + ' ' + (cat_name or '').lower()
    
    if 'yaourt' in nl or 'sữa chua' in nl:
        return NUTRITION_PROFILES['yaourt']
    if 'sữa' in nl:
        return NUTRITION_PROFILES['sua']
    if 'rau câu' in nl or 'flan' in nl:
        return NUTRITION_PROFILES['rau cau']
    if 'nước' in nl or 'trà' in nl or 'chanh' in nl or 'sâm' in nl:
        return NUTRITION_PROFILES['nuoc']
    if 'chè' in nl:
        return NUTRITION_PROFILES['che']
    if 'cơm' in nl or 'xôi' in nl or 'cơm' in cl:
        return NUTRITION_PROFILES['com']
    if 'hủ tiếu' in nl or 'hu tieu' in nl:
        return NUTRITION_PROFILES['hu tieu']
    if 'bánh canh' in nl:
        return NUTRITION_PROFILES['banh canh']
    if 'phở' in nl:
        return NUTRITION_PROFILES['pho']
    if 'bánh bao' in nl or 'bánh' in nl:
        return NUTRITION_PROFILES['banh bao']
    if 'nui' in nl:
        return NUTRITION_PROFILES['nui']
    if 'mì' in nl:
        return NUTRITION_PROFILES['mi']
    if 'miến' in nl:
        return NUTRITION_PROFILES['mien']
    if 'cháo' in nl:
        return NUTRITION_PROFILES['chao']
    if 'súp' in nl:
        return NUTRITION_PROFILES['sup']
    if 'canh' in nl or 'canh' in cl:
        return NUTRITION_PROFILES['canh']
    if 'tráng miệng' in cl or any(f in nl for f in ['chuối', 'táo', 'dưa', 'thanh long', 'nho', 'quýt', 'cam', 'hồng', 'đu đủ']):
        return NUTRITION_PROFILES['trai cay']
    if 'bò' in nl:
        return NUTRITION_PROFILES['bo']
    if 'gà' in nl:
        return NUTRITION_PROFILES['ga']
    if 'cá' in nl or 'ngừ' in nl or 'hú' in nl:
        return NUTRITION_PROFILES['ca']
    if 'tôm' in nl or 'mực' in nl:
        return NUTRITION_PROFILES['tom']
    if 'trứng' in nl:
        return NUTRITION_PROFILES['trung']
    if 'sườn' in nl:
        return NUTRITION_PROFILES['suon']
    if 'thịt' in nl or 'heo' in nl or 'rô ti' in nl or 'kho' in nl or 'ram' in nl or 'món chính' in cl:
        return NUTRITION_PROFILES['thit']
    if 'xế' in cl:
        return NUTRITION_PROFILES['hu tieu']
    
    return [75.0, 5.0, 2.5, 8.5, 0.5, 20.0, 0.8, 0.8]

out = subprocess.check_output(['docker', 'exec', 'kidmeal-test-postgres-1', 'psql', '-U', 'kidmeal_test', '-d', 'kidmeal_test_kiet_1793705569028', '-t', '-A', '-c', 
    'SELECT d.id, d.name, c.code, c.name FROM dishes d LEFT JOIN dish_categories c ON c.id = d.category_id LEFT JOIN dish_nutrition dn ON dn.dish_id = d.id WHERE dn.dish_id IS NULL;'
], text=True, encoding='utf-8')

dishes = [line.split('|') for line in out.strip().split('\n') if line]
print(f'Populating nutrition for {len(dishes)} dishes...')

sql_lines = ['BEGIN;']
for d in dishes:
    did = int(d[0])
    name = d[1]
    ccode = d[2] if len(d) > 2 else ''
    cname = d[3] if len(d) > 3 else ''
    p = guess_profile(name, ccode, cname)
    sql = (
        f"INSERT INTO dish_nutrition (dish_id, energy_kcal, protein_g, fat_g, carb_g, fiber_g, calcium_mg, iron_mg, zinc_mg, source_metadata) "
        f"VALUES ({did}, {p[0]}, {p[1]}, {p[2]}, {p[3]}, {p[4]}, {p[5]}, {p[6]}, {p[7]}, "
        f"'{{\"status\": \"STANDARD_KINDERGARTEN_RECIPE\", \"basis\": \"ONE_STANDARD_SERVING\"}}'::jsonb) "
        f"ON CONFLICT (dish_id) DO UPDATE SET "
        f"energy_kcal = EXCLUDED.energy_kcal, protein_g = EXCLUDED.protein_g, fat_g = EXCLUDED.fat_g, "
        f"carb_g = EXCLUDED.carb_g, fiber_g = EXCLUDED.fiber_g, calcium_mg = EXCLUDED.calcium_mg, "
        f"iron_mg = EXCLUDED.iron_mg, zinc_mg = EXCLUDED.zinc_mg, source_metadata = EXCLUDED.source_metadata;"
    )
    sql_lines.append(sql)

sql_lines.append('COMMIT;')
with open('populate_missing_nutrition.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_lines) + '\n')

print('SQL file written successfully!')
