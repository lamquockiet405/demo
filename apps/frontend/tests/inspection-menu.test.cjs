const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');const path = require('node:path');const ts = require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/features/kitchen/utils/inspection-menu.ts'),'utf8');
const moduleValue={exports:{}};
new Function('module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(moduleValue,moduleValue.exports);
const {extractInspectionMenuDishes,isInspectionMenuForDate,inspectionDishNames}=moduleValue.exports;
const menu={id:'1',title:'Thực đơn mẫu giáo',status:'PUBLISHED',startDate:'2026-11-02',endDate:'2026-11-08',days:[
  {date:'2026-11-04',meals:[{mealType:'LUNCH',dishes:[{dishId:'1',dishName:'Canh rau'},{dishId:'2',dishName:'Thịt kho'}]},{mealType:'AFTERNOON_SNACK',dishes:[{dishId:'3',dishName:'Sữa chua'}]},{mealType:'MORNING_SNACK',dishes:[{dishId:'4',dishName:'Cháo sáng'}]}]},
  {date:'2026-11-05',meals:[{mealType:'LUNCH',dishes:[{dishId:'5',dishName:'Cá sốt'}]}]},
]};
test('only returns dishes for the exact calendar date and selected meal',()=>{
 assert.deepEqual(extractInspectionMenuDishes([menu],'2026-11-04','LUNCH').map(d=>d.name),['Canh rau','Thịt kho']);
 assert.deepEqual(extractInspectionMenuDishes([menu],'2026-11-04','AFTERNOON_SNACK').map(d=>d.name),['Sữa chua']);
 assert.deepEqual(extractInspectionMenuDishes([menu],'2026-11-06','LUNCH'),[]);
 assert.deepEqual(extractInspectionMenuDishes([menu],'2026-11-10','LUNCH'),[]);
});
test('draft and rejected menus cannot supply kitchen inspection dishes',()=>{
 for(const status of ['DRAFT','REJECTED','PENDING','ARCHIVED'])assert.deepEqual(extractInspectionMenuDishes([{...menu,status}],'2026-11-04','LUNCH'),[]);
 for(const status of ['PUBLISHED','ACTIVE','APPROVED'])assert.equal(isInspectionMenuForDate({...menu,status},'2026-11-04'),true);
});
test('breakfast supports the existing morning-snack menu slot',()=>{
 assert.deepEqual(extractInspectionMenuDishes([menu],'2026-11-04','BREAKFAST').map(d=>d.name),['Cháo sáng']);
});
test('deduplicates dishes across age-group menus while preserving their sources',()=>{
 const result=extractInspectionMenuDishes([menu,{...menu,id:'2',title:'Thực đơn nhà trẻ'}],'2026-11-04','LUNCH');
 assert.equal(result.length,2);assert.deepEqual(result[0].menus,['Thực đơn mẫu giáo','Thực đơn nhà trẻ']);
 assert.deepEqual(inspectionDishNames(result,'Canh rau\n Món bổ sung\n\nMÓN BỔ SUNG').map(s=>s.toLocaleLowerCase('vi')),['canh rau','thịt kho','món bổ sung']);
});
test('does not invent dishes when no approved menu is available and rejects broken details',()=>{
 assert.deepEqual(extractInspectionMenuDishes([],'2026-11-04','LUNCH'),[]);
 assert.equal(isInspectionMenuForDate({status:'PUBLISHED'},'2026-11-04'),false);
 assert.throws(()=>extractInspectionMenuDishes([{...menu,days:null}],'2026-11-04','LUNCH'));
});
