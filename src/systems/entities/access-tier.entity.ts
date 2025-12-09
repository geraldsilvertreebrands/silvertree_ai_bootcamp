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
import { System } from './system.entity';

@Entity('access_tiers')
@Index(['systemId', 'name'], { unique: true })
export class AccessTier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  systemId: string;

  @ManyToOne(() => System, (system) => system.accessTiers)
  @JoinColumn({ name: 'systemId' })
  system: System;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
