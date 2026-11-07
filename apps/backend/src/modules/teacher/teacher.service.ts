import {BadRequestException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {DataSource} from 'typeorm';
import {ClassesService} from '../classes/classes.service';
import {ChildrenService} from '../children/services/children.service';
import {GrowthService} from '../growth/services/growth.service';
import {GrowthDispatchService} from '../growth/services/growth-dispatch.service';
import {NutritionAdviceService} from '../nutrition-advice/services/nutrition-advice.service';
import {COORDINATION_MEAL_LABELS,MealCoordinationService} from '../attendance/services/meal-coordination.service';
import {schoolDate} from '../../common/utils/persisted-state';

export const MEAL_STATES=['FULL','MOST','HALF','LITTLE','NONE'];
export const MEALS=['BREAKFAST','MORNING_SNACK','LUNCH','AFTERNOON_SNACK'];
@Injectable()
export class TeacherService {
 constructor(private readonly db:DataSource,private readonly classes:ClassesService,private readonly children:ChildrenService,private readonly growth:GrowthService,private readonly dispatch:GrowthDispatchService,private readonly advice:NutritionAdviceService,private readonly notes:MealCoordinationService){}
 async scope(actor:any){if(!actor?.sub)throw new ForbiddenException();return this.db.query('SELECT id,name,age_group AS "ageGroup",school_year AS "schoolYear",status FROM classes WHERE homeroom_teacher_id=$1 AND school_id=$2 AND academic_year_id IN (SELECT id FROM academic_year WHERE status=\'ACTIVE\') ORDER BY name',[Number(actor.sub),Number(actor.tenantId)||1]);}
 async classAccess(actor:any,id:any){const classes=await this.scope(actor);if(!classes.some(c=>Number(c.id)===Number(id)))throw new ForbiddenException('Lớp không thuộc phân công của giáo viên.');return Number(id);}
 async childAccess(actor:any,id:any){const rows=await this.db.query('SELECT id,class_id FROM students WHERE id=$1',[Number(id)]);if(!rows[0])throw new NotFoundException('Không tìm thấy học sinh.');await this.classAccess(actor,rows[0].class_id);return rows[0];}
 async allowedIds(actor:any,classId?:any){const assigned=await this.scope(actor);if(classId&&classId!=='ALL'){await this.classAccess(actor,classId);return [Number(classId)];}return assigned.map(c=>Number(c.id));}
 date(value?:string){const date=value||schoolDate();if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(new Date(date+'T12:00:00Z').getTime()))throw new BadRequestException('Ngày không hợp lệ.');return date;}
 meal(value?:string){const m=value||'LUNCH';if(!MEALS.includes(m))throw new BadRequestException('Bữa ăn không hợp lệ.');return m;}
 noteMeal(value?:string){const m=value||'LUNCH';if(!Object.prototype.hasOwnProperty.call(COORDINATION_MEAL_LABELS,m))throw new BadRequestException('Bữa ăn không hợp lệ.');return m;}
 async classList(actor:any,q:any){const ids=await this.allowedIds(actor);return (await this.classes.findAll(q,Number(actor.tenantId)||1)).filter(c=>ids.includes(Number(c.id)));}
 async classDetail(actor:any,id:any){await this.classAccess(actor,id);return this.classes.findOne(Number(id));}
 async updateClass(actor:any,id:any,data:any){await this.classAccess(actor,id);if(data.homeroomTeacherId!==undefined&&Number(data.homeroomTeacherId)!==Number(actor.sub))throw new ForbiddenException('Giáo viên không được thay đổi người phụ trách.');const {name,ageGroup,schoolYear}=data;return this.classes.update(Number(id),{...(name!==undefined?{name}:{}),...(ageGroup!==undefined?{ageGroup}:{}),...(schoolYear!==undefined?{schoolYear}:{})});}
 async childList(actor:any,q:any){
  const ids=await this.allowedIds(actor,q.classId);
  const all=await Promise.all(ids.map(id=>this.children.findAll({...q,classId:String(id),page:1,limit:100000})));
  const rows=all.flatMap((r:any)=>r.items||r.data||[]);
  const page=Math.max(1,Number(q.page)||1),limit=Math.min(1000,Math.max(1,Number(q.limit)||200));
  const items=rows.slice((page-1)*limit,page*limit);
  const keys=items.map((row:any)=>`child-nutrition:${row.id}`);
  const profiles=keys.length?await this.db.query('SELECT config_key FROM system_configs WHERE config_key=ANY($1::text[])',[keys]):[];
  const existing=new Set(profiles.map((row:any)=>row.config_key));
  // Keep the collection envelope intact; the global interceptor flattens items + meta.
  return {items:items.map((row:any)=>({...row,hasNutritionProfile:existing.has(`child-nutrition:${row.id}`)})),total:rows.length,page,limit,totalPages:Math.ceil(rows.length/limit)};
 }
 async childDetail(actor:any,id:any){await this.childAccess(actor,id);return this.children.findOne(Number(id));}
 async createChild(actor:any,dto:any){await this.classAccess(actor,dto.classId);return this.children.create(dto);}
 async updateChild(actor:any,id:any,dto:any){await this.childAccess(actor,id);if(dto.classId!==undefined)await this.classAccess(actor,dto.classId);return this.children.update(Number(id),dto);}
 async importChildren(actor:any,items:any[]){if(!Array.isArray(items)||!items.length||items.length>1000)throw new BadRequestException('Nhập từ 1 đến 1000 học sinh.');for(const item of items){await this.classAccess(actor,item.classId);if(item.studentCode){const existing=await this.db.query('SELECT id FROM students WHERE student_code=$1',[item.studentCode]);if(existing[0])await this.childAccess(actor,existing[0].id);}}return this.children.importChildren(items);}
 async profile(actor:any,id:any,dto?:any){await this.childAccess(actor,id);return dto===undefined?this.children.getNutritionProfile(Number(id),actor):this.children.updateNutritionProfile(Number(id),dto,actor);}
 async growthList(actor:any,q:any){const ids=await this.allowedIds(actor,q.classId);if(q.childId||q.studentId)await this.childAccess(actor,q.childId||q.studentId);const pages=await Promise.all(ids.map(id=>this.growth.findAll({...q,classId:String(id),page:1,limit:100000})));const items=pages.flatMap(r=>r.items).sort((a,b)=>b.measurementDate.localeCompare(a.measurementDate));return {items,total:items.length};}
 async growthHistory(actor:any,id:any){await this.childAccess(actor,id);return this.growth.getChildHistory(Number(id));}
 async growthWrite(actor:any,dto:any,id?:any){if(id){const current=await this.db.query('SELECT student_id FROM physical_measurements WHERE id=$1',[Number(id)]);if(!current[0])throw new NotFoundException();await this.childAccess(actor,current[0].student_id);}let studentId=dto.studentId||dto.childId;if(!studentId&&dto.studentCode){const rows=await this.db.query('SELECT id FROM students WHERE student_code=$1',[dto.studentCode]);studentId=rows[0]?.id;}if(studentId)await this.childAccess(actor,studentId);else if(!id)throw new BadRequestException('Chọn học sinh hợp lệ.');const body={...dto,...(studentId?{studentId:Number(studentId),childId:String(studentId)}:{})};return id?this.growth.updateRecord(Number(id),body):this.growth.createRecord(body,Number(actor.sub));}
 async growthImport(actor:any,items:any[]){if(!Array.isArray(items)||!items.length||items.length>1000)throw new BadRequestException('Nhập từ 1 đến 1000 dòng cân đo.');const checked=[];for(const item of items){let id=item.studentId||item.childId;if(!id&&item.studentCode){const rows=await this.db.query('SELECT id FROM students WHERE student_code=$1',[String(item.studentCode)]);id=rows[0]?.id;}if(!id)throw new BadRequestException('Không tìm thấy mã học sinh.');await this.childAccess(actor,id);checked.push({...item,studentId:Number(id),childId:String(id)});}return this.growth.importRecords(checked,Number(actor.sub));}
 async mealList(actor:any,q:any){const ids=await this.allowedIds(actor,q.classId);const date=this.date(q.date),meal=this.meal(q.mealType);return this.db.query(`SELECT s.id AS "studentId",s.full_name AS "fullName",s.student_code AS "studentCode",s.class_id AS "classId",c.name AS "className",a.id AS "recordId",a.is_attended AS "isAttended",a.consumption_level AS "consumptionLevel",a.note FROM students s JOIN classes c ON c.id=s.class_id LEFT JOIN meal_attendances a ON a.student_id=s.id AND a.date=$2 AND a.meal_type=$3 WHERE s.class_id=ANY($1::bigint[]) AND (s.full_name ILIKE $4 OR s.student_code ILIKE $4) ORDER BY c.name,s.full_name`,[ids,date,meal,'%'+(q.search||'')+'%']);}
 validateMealItem(data:any){
  if(typeof data.isAttended!=='boolean')throw new BadRequestException('Chọn có mặt hoặc vắng mặt cho từng học sinh.');
  if(data.consumptionLevel && !MEAL_STATES.includes(data.consumptionLevel) && !['PARTIAL','ALL','FEW'].includes(data.consumptionLevel))throw new BadRequestException('Mức ăn không hợp lệ.');
  if(data.note!=null&&typeof data.note!=='string')throw new BadRequestException('Ghi chú không hợp lệ.');
 }
 async lockMeal(tx:any,classId:number,date:string,meal:string){
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`class-meal:${classId}:${date}:${meal}`]);
  const locked=await tx.query('SELECT is_locked FROM meal_evaluation_locks WHERE class_id=$1 AND date=$2 AND meal_type=$3',[classId,date,meal]);
  if(locked[0]?.is_locked)throw new BadRequestException('Bữa ăn đã chốt kết quả, không thể sửa điểm danh.');
 }
 async writeMealItem(tx:any,actor:any,id:number,date:string,meal:string,data:any){
  return tx.query(`INSERT INTO meal_attendances(student_id,date,meal_type,is_attended,consumption_level,note,recorded_by)
   VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(student_id,date,meal_type) DO UPDATE SET
   is_attended=EXCLUDED.is_attended,consumption_level=EXCLUDED.consumption_level,note=EXCLUDED.note,recorded_by=EXCLUDED.recorded_by RETURNING id`,
   [id,date,meal,data.isAttended,data.isAttended?(data.consumptionLevel||null):null,data.note?.trim()||null,Number(actor.sub)]);
 }
 async mealWrite(actor:any,id:any,data:any){
  const child=await this.childAccess(actor,id),date=this.date(data.date),meal=this.meal(data.mealType);
  this.validateMealItem(data);
  return this.db.transaction(async tx=>{
   await this.lockMeal(tx,Number(child.class_id),date,meal);
   return this.writeMealItem(tx,actor,Number(id),date,meal,data);
  });
 }
 async mealSubmissions(actor:any,q:any){
  const ids=await this.allowedIds(actor,q.classId);
  return this.db.query(`SELECT class_id AS "classId",planned_quantity AS quantity,
   attendance_submitted_at AS "submittedAt",attendance_snapshot AS snapshot
   FROM daily_meal_portions WHERE class_id=ANY($1::bigint[]) AND date=$2 AND meal_type=$3 AND attendance_submitted_at IS NOT NULL`,
   [ids,this.date(q.date),this.meal(q.mealType)]);
 }
 async submitMeals(actor:any,data:any){
  const classId=await this.classAccess(actor,data.classId),date=this.date(data.date),meal=this.meal(data.mealType);
  if(!Array.isArray(data.items)||!data.items.length||data.items.length>1000)throw new BadRequestException('Điểm danh đầy đủ học sinh của lớp trước khi gửi bếp.');
  for(const item of data.items)this.validateMealItem(item);
  const ids=data.items.map((item:any)=>Number(item.studentId));
  if(ids.some((id:number)=>!Number.isSafeInteger(id)||id<=0)||new Set(ids).size!==ids.length)throw new BadRequestException('Danh sách học sinh không hợp lệ hoặc bị trùng.');
  return this.db.transaction(async tx=>{
   await this.lockMeal(tx,classId,date,meal);
   const students=await tx.query('SELECT id,full_name FROM students WHERE class_id=$1 ORDER BY id FOR SHARE',[classId]);
   if(students.length!==ids.length||students.some((s:any)=>!ids.includes(Number(s.id))))throw new BadRequestException('Danh sách lớp đã thay đổi hoặc chưa đủ học sinh. Hãy làm mới và điểm danh lại.');
   const byId=new Map<number,any>(data.items.map((item:any)=>[Number(item.studentId),item]));
   const snapshot=students.map((student:any)=>{
    const item=byId.get(Number(student.id));
    return {studentId:String(student.id),fullName:student.full_name,isAttended:item.isAttended,note:item.note?.trim()||''};
   });
   for(const student of students)await this.writeMealItem(tx,actor,Number(student.id),date,meal,byId.get(Number(student.id)));
   const quantity=snapshot.filter((item:any)=>item.isAttended).length;
   const result=await tx.query(`INSERT INTO daily_meal_portions(class_id,date,meal_type,planned_quantity,attendance_submitted_at,attendance_submitted_by,attendance_snapshot)
    VALUES($1,$2,$3,$4,NOW(),$5,$6::jsonb) ON CONFLICT(class_id,date,meal_type) DO UPDATE SET
    planned_quantity=EXCLUDED.planned_quantity,attendance_submitted_at=EXCLUDED.attendance_submitted_at,
    attendance_submitted_by=EXCLUDED.attendance_submitted_by,attendance_snapshot=EXCLUDED.attendance_snapshot
    RETURNING attendance_submitted_at AS "submittedAt"`,[classId,date,meal,quantity,Number(actor.sub),JSON.stringify(snapshot)]);
   return {classId:String(classId),date,mealType:meal,quantity,total:snapshot.length,absent:snapshot.length-quantity,submittedAt:result[0].submittedAt};
  });
 }
 async history(actor:any,q:any){const ids=await this.allowedIds(actor,q.classId);const start=this.date(q.startDate),end=this.date(q.endDate||q.startDate);if(start>end)throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc.');return this.db.query(`SELECT a.id,a.date,a.meal_type AS "mealType",a.is_attended AS "isAttended",a.consumption_level AS "consumptionLevel",a.note,s.id AS "studentId",s.full_name AS "fullName",s.student_code AS "studentCode",c.name AS "className" FROM meal_attendances a JOIN students s ON s.id=a.student_id JOIN classes c ON c.id=s.class_id WHERE s.class_id=ANY($1::bigint[]) AND a.date BETWEEN $2 AND $3 AND ($4='' OR a.meal_type=$4) AND (s.full_name ILIKE $5 OR s.student_code ILIKE $5) AND ($6='' OR a.consumption_level=$6) ORDER BY a.date DESC,c.name,s.full_name`,[ids,start,end,q.mealType||'','%'+(q.search||'')+'%',q.consumptionLevel||'']);}
 async roster(actor:any,q:any){const ids=await this.allowedIds(actor,q.classId),date=this.date(q.date);return this.db.query(`SELECT r.id,s.id AS "studentId",s.full_name AS "fullName",s.student_code AS "studentCode",c.name AS "className",p.name AS "periodName",r.status,p.start_date AS "startDate",p.end_date AS "endDate" FROM snack_registrations r JOIN students s ON s.id=r.student_id JOIN classes c ON c.id=s.class_id JOIN snack_service_periods p ON p.id=r.period_id WHERE s.class_id=ANY($1::bigint[]) AND $2 BETWEEN p.start_date AND p.end_date AND ($3='' OR r.status=$3) AND (s.full_name ILIKE $4 OR s.student_code ILIKE $4) ORDER BY c.name,s.full_name`,[ids,date,q.status||'','%'+(q.search||'')+'%']);}
 async portions(actor:any,q:any){const ids=await this.allowedIds(actor,q.classId);return this.db.query(`SELECT c.id AS "classId",c.name AS "className",p.meal_type AS "mealType",p.planned_quantity AS "plannedQuantity",p.actual_quantity AS "actualQuantity" FROM classes c LEFT JOIN daily_meal_portions p ON p.class_id=c.id AND p.date=$2 WHERE c.id=ANY($1::bigint[]) ORDER BY c.name,p.meal_type`,[ids,this.date(q.date)]);}
 async portionWrite(actor:any,data:any){await this.classAccess(actor,data.classId);if(!Number.isSafeInteger(data.plannedQuantity)||data.plannedQuantity<0)throw new BadRequestException('Số suất phải là số nguyên không âm.');return this.db.query(`INSERT INTO daily_meal_portions(class_id,date,meal_type,planned_quantity) VALUES($1,$2,$3,$4) ON CONFLICT(class_id,date,meal_type) DO UPDATE SET planned_quantity=EXCLUDED.planned_quantity RETURNING id`,[Number(data.classId),this.date(data.date),this.meal(data.mealType),data.plannedQuantity]);}
 async noteList(actor:any,q:any){const ids=await this.allowedIds(actor,q.classId);return this.db.query(`SELECT n.*,to_char(n.meal_date,'YYYY-MM-DD') AS meal_date,c.name AS "className" FROM meal_coordination_notes n JOIN classes c ON c.id=n.class_id WHERE n.class_id=ANY($1::bigint[]) AND n.meal_date=$2 ORDER BY n.created_at DESC`,[ids,this.date(q.date)]);}
 async noteWrite(actor:any,data:any,id?:any){await this.classAccess(actor,data.classId);if(data.childId){const child=await this.childAccess(actor,data.childId);if(Number(child.class_id)!==Number(data.classId))throw new BadRequestException('Học sinh không thuộc lớp đã chọn.');}if(!data.title?.trim()||!data.content?.trim())throw new BadRequestException('Nhập tiêu đề và nội dung ghi chú.');const body={classId:String(data.classId),childId:data.childId?String(data.childId):undefined,mealDate:this.date(data.mealDate),mealSession:this.noteMeal(data.mealSession),title:data.title.trim(),content:data.content.trim(),noteType:data.noteType||'OTHER',priority:data.priority||'NORMAL',targetRole:'KITCHEN',teacherName:actor.fullName||actor.email};if(id){await this.noteAccess(actor,id);return this.notes.update(String(id),body);}return this.notes.create(body,Number(actor.sub));}
 async noteAccess(actor:any,id:any){const rows=await this.db.query('SELECT class_id FROM meal_coordination_notes WHERE id=$1',[Number(id)]);if(!rows[0])throw new NotFoundException();await this.classAccess(actor,rows[0].class_id);}
 async noteDelete(actor:any,id:any){await this.noteAccess(actor,id);return this.notes.delete(String(id));}
 async picky(actor:any,q:any){const ids=await this.allowedIds(actor,q.classId);const results=await Promise.all(ids.map(id=>this.advice.detectPickyEating(String(id),q.search)));const classes=await this.scope(actor),items=results.flatMap(r=>r.items);return {items,classes,summary:{totalDetected:items.length}};}
 async adviceHistory(actor:any,id?:any){const ids=await this.allowedIds(actor);if(id)await this.childAccess(actor,id);const rows=await this.db.query('SELECT a.* FROM picky_eating_advices a JOIN students s ON s.id=a.student_id WHERE s.class_id=ANY($1::bigint[]) AND ($2::bigint IS NULL OR a.student_id=$2) ORDER BY a.created_at DESC',[ids,id?Number(id):null]);return rows.map(r=>({...r,studentId:r.student_id,adviceTitle:r.advice_title,homeSupplementAdvice:r.home_supplement_advice,createdAt:r.created_at}));}
 async sendAdvice(actor:any,dto:any){await this.childAccess(actor,dto.studentId);return this.advice.sendAdvice(dto,Number(actor.sub));}
 async notifications(actor:any,q:any){const data=await this.dispatch.getNotificationsByRole('TEACHER',Number(actor.sub),q);return {data,total:data.length};}
 async scan(actor:any){const ids=await this.allowedIds(actor);return this.dispatch.scanAndDispatchNotifications(Number(actor.tenantId)||1,ids);}
 async alerts(actor:any,q:any){const children=(await this.childList(actor,{classId:q.classId,limit:1000})).items;const records=(await this.growthList(actor,{classId:q.classId})).items;const latest=new Map();for(const r of records)if(!latest.has(r.childId))latest.set(r.childId,r);return {allergies:children.filter((c:any)=>c.allergies?.length),growth:[...latest.values()].filter(r=>r.overallNutritionalStatus&&r.overallNutritionalStatus!=='NORMAL')};}
 async report(actor:any,q:any){const date=this.date(q.date);const rows=await this.history(actor,{...q,startDate:date,endDate:date});return {date,recorded:rows.length,present:rows.filter(r=>r.isAttended).length,absent:rows.filter(r=>!r.isAttended).length,consumption:MEAL_STATES.map(status=>({status,count:rows.filter(r=>r.isAttended&&r.consumptionLevel===status).length})),classes:await this.scope(actor),rows};}
}
