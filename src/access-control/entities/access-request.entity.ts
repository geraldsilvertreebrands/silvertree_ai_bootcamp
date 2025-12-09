import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../identity/entities/user.entity';
import { SystemInstance } from '../../systems/entities/system-instance.entity';
import { AccessTier } from '../../systems/entities/access-tier.entity';

export enum AccessRequestStatus {
  REQUESTED = 'requested',
  APPROVED = 'approved',
}

@Entity('access_requests')
@Index(['targetUserId'])
@Index(['requesterId'])
export class AccessRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  targetUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'targetUserId' })
  targetUser: User;

  @Column({ type: 'uuid' })
  requesterId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requesterId' })
  requester: User;

  @Column({
    type: 'enum',
    enum: AccessRequestStatus,
    default: AccessRequestStatus.REQUESTED,
  })
  status: AccessRequestStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @OneToMany(() => AccessRequestItem, (item) => item.accessRequest, { cascade: true })
  items: AccessRequestItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export enum AccessRequestItemStatus {
  REQUESTED = 'requested',
  APPROVED = 'approved',
}

@Entity('access_request_items')
@Index(['accessRequestId'])
export class AccessRequestItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  accessRequestId: string;

  @ManyToOne(() => AccessRequest, (request) => request.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accessRequestId' })
  accessRequest: AccessRequest;

  @Column({ type: 'uuid' })
  systemInstanceId: string;

  @ManyToOne(() => SystemInstance)
  @JoinColumn({ name: 'systemInstanceId' })
  systemInstance: SystemInstance;

  @Column({ type: 'uuid' })
  accessTierId: string;

  @ManyToOne(() => AccessTier)
  @JoinColumn({ name: 'accessTierId' })
  accessTier: AccessTier;

  @Column({
    type: 'enum',
    enum: AccessRequestItemStatus,
    default: AccessRequestItemStatus.REQUESTED,
  })
  status: AccessRequestItemStatus;

  @Column({ type: 'uuid', nullable: true })
  accessGrantId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

