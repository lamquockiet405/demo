import { BadRequestException } from '@nestjs/common';

export function isFriedRice(name: string): boolean {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
  return /\bcom\s+(chien|duong\s+chau)\b/.test(normalized);
}

export function isFriday(weekStartDate: string, dayIndex: number): boolean {
  const date = new Date(`${weekStartDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new BadRequestException('Ngày bắt đầu thực đơn không hợp lệ.');
  date.setUTCDate(date.getUTCDate() + dayIndex);
  return date.getUTCDay() === 5;
}

type LunchDish = { dishId: string; mealTime: string };
type CatalogDish = { id: number; name: string; category?: { code: string } };

export function validateLunchRice(
  dishes: LunchDish[], friday: boolean, catalog: CatalogDish[],
): void {
  const lunch = dishes.filter(dish => dish.mealTime === 'LUNCH')
    .map(dish => catalog.find(item => Number(item.id) === Number(dish.dishId)));
  const rice = lunch.filter(dish => dish?.category?.code === 'RICE');
  const mains = lunch.filter(dish => dish?.category?.code === 'MAIN');
  if (rice.length !== 1) throw new BadRequestException('Mỗi bữa trưa phải có đúng một món cơm.');
  if (friday && (!isFriedRice(rice[0].name) || mains.length > 0)) {
    throw new BadRequestException('Bữa trưa thứ Sáu phải có cơm chiên và không kèm món mặn.');
  }
  if (!friday && (isFriedRice(rice[0].name) || mains.length === 0)) {
    throw new BadRequestException('Bữa trưa các ngày khác phải có cơm thường và món mặn.');
  }
}
