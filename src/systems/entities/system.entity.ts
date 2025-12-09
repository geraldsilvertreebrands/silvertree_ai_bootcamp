import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SystemInstance } from './system-instance.entity';
import { AccessTier } from './access-tier.entity';

@Entity('systems')
export class System {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @OneToMany(() => SystemInstance, (instance) => instance.system)
  instances: SystemInstance[];

  @OneToMany(() => AccessTier, (tier) => tier.system)
  accessTiers: AccessTier[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
