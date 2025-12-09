import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../identity/entities/user.entity';
import { SystemInstance } from '../../systems/entities/system-instance.entity';
import { AccessTier } from '../../systems/entities/access-tier.entity';

export enum AccessGrantStatus {
  ACTIVE = 'active',
  REMOVED = 'removed',
  TO_REMOVE = 'to_remove',
}

@Entity('access_grants')
@Index(['userId'])
@Index(['systemInstanceId'])
@Index(['status'])
@Index(['userId', 'systemInstanceId', 'accessTierId', 'status'], {
  unique: true,
  where: "status = 'active'",
})
export class AccessGrant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

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
    enum: AccessGrantStatus,
    default: AccessGrantStatus.ACTIVE,
  })
  status: AccessGrantStatus;

  @Column({ type: 'uuid', nullable: true })
  grantedById: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'grantedById' })
  grantedBy: User | null;

  @Column({ type: 'timestamp', nullable: true })
  grantedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  removedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
