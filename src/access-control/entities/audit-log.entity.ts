import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../identity/entities/user.entity';

export enum AuditAction {
  REQUEST_CREATED = 'request_created',
  REQUEST_APPROVED = 'request_approved',
  REQUEST_REJECTED = 'request_rejected',
  GRANT_CREATED = 'grant_created',
  GRANT_ACTIVATED = 'grant_activated',
  GRANT_MARKED_FOR_REMOVAL = 'grant_marked_for_removal',
  GRANT_REMOVED = 'grant_removed',
  ITEM_APPROVED = 'item_approved',
  ITEM_REJECTED = 'item_rejected',
  ITEM_PROVISIONED = 'item_provisioned',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  action: AuditAction;

  @Column({ name: 'actor_id' })
  actorId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'actor_id' })
  actor: User;

  @Column({ name: 'target_user_id', nullable: true })
  targetUserId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'target_user_id' })
  targetUser: User;

  @Column({ name: 'resource_type', length: 50 })
  resourceType: string; // 'access_request', 'access_grant', 'access_request_item'

  @Column({ name: 'resource_id' })
  resourceId: string;

  @Column({ type: 'text', nullable: true })
  details: string; // JSON string with additional details

  @Column({ type: 'text', nullable: true })
  reason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
