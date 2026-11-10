import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../../auth/entities/user.entity";
import { UpdateProfileDto } from "../dto/update-profile.dto";

@Injectable()
export class UserProfileService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getProfile(userId: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ["roles"],
    });
    if (!user) {
      throw new NotFoundException("Không tìm thấy thông tin tài khoản");
    }

    return {
      id: String(user.id),
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      avatarUrl: user.avatar,
      status: user.status,
      roles: user.roles?.map((r) => r.code) || [],
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      twoFactorEnabled: false,
    };
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Không tìm thấy thông tin tài khoản");
    }

    const updateData: Partial<User> = {};
    if (dto.fullName !== undefined) updateData.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.avatar !== undefined) updateData.avatar = dto.avatar;

    if (Object.keys(updateData).length > 0) {
      await this.userRepo.update(userId, updateData);
    }
    return this.getProfile(userId);
  }
}
