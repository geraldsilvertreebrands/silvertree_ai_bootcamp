import { DataSource } from 'typeorm';
import { User } from '../identity/entities/user.entity';
import { System } from '../systems/entities/system.entity';
import { SystemInstance } from '../systems/entities/system-instance.entity';
import { AccessTier } from '../systems/entities/access-tier.entity';
import { AccessGrant, AccessGrantStatus } from '../access-control/entities/access-grant.entity';

const seedUsers = [
  { name: 'John Smith', email: 'john.smith@silvertreebrands.com' },
  { name: 'Sarah Johnson', email: 'sarah.johnson@silvertreebrands.com' },
  { name: 'Alex van der Merwe', email: 'alex.vandermerwe@silvertreebrands.com' },
  { name: 'Jane Botha', email: 'jane.botha@silvertreebrands.com' },
  { name: 'Sipho Ndlovu', email: 'sipho.ndlovu@silvertreebrands.com' },
  { name: 'Lerato Mthembu', email: 'lerato.mthembu@silvertreebrands.com' },
  { name: 'Gerald Adams', email: 'gerald.adams@silvertreebrands.com' },
  { name: 'Emma Wilson', email: 'emma.wilson@silvertreebrands.com' },
  { name: 'Michael Chen', email: 'michael.chen@silvertreebrands.com' },
  { name: 'David van Niekerk', email: 'david.vanniekerk@silvertreebrands.com' },
  { name: 'Gerald Sadya', email: 'geralds@silvertreebrands.com' },
];

const seedSystems = [
  { name: 'Magento', description: 'E-commerce platform for UCOOK, Faithful to Nature, and PetHeaven' },
  { name: 'Acumatica', description: 'ERP system for financial and inventory management' },
  { name: 'Google Analytics', description: 'Web analytics and tracking platform' },
  { name: 'Zoho People', description: 'HR management and employee database' },
  { name: 'Shopify', description: 'E-commerce platform for SKOON and other brands' },
];

export async function seedDatabase(dataSource: DataSource) {
  const userRepository = dataSource.getRepository(User);
  const systemRepository = dataSource.getRepository(System);
  const instanceRepository = dataSource.getRepository(SystemInstance);
  const tierRepository = dataSource.getRepository(AccessTier);
  const grantRepository = dataSource.getRepository(AccessGrant);

  console.log('🌱 Seeding database...');

  // Clean up access requests first (they reference users)
  console.log('Cleaning up access requests...');
  try {
    await dataSource.query('DELETE FROM access_request_items');
    await dataSource.query('DELETE FROM access_requests');
    console.log('  ✓ Cleared all access requests');
  } catch (error) {
    // Ignore if table doesn't exist yet
    console.log('  - Access requests table does not exist yet');
  }

  // Clean up test users first (must delete grants first due to foreign key constraints)
  console.log('Cleaning up test users...');
  const testUsers = await userRepository
    .createQueryBuilder('user')
    .where('user.email LIKE :testPattern1 OR user.email LIKE :testPattern2', {
      testPattern1: '%@test.%',
      testPattern2: '%@example.%',
    })
    .getMany();
  
  if (testUsers.length > 0) {
    const testUserIds = testUsers.map(u => u.id);
    
    // Delete access requests for test users first
    try {
      const { AccessRequest } = await import('../access-control/entities/access-request.entity');
      const accessRequestRepository = dataSource.getRepository(AccessRequest);
      await accessRequestRepository
        .createQueryBuilder()
        .delete()
        .where('requesterId IN (:...userIds) OR targetUserId IN (:...userIds)', { userIds: testUserIds })
        .execute();
    } catch (error) {
      // Ignore if table doesn't exist yet
    }
    
    // Delete access grants for test users
    await grantRepository
      .createQueryBuilder()
      .delete()
      .where('userId IN (:...userIds)', { userIds: testUserIds })
      .execute();
    
    // Delete system owners for test users
    const { SystemOwner } = await import('../ownership/entities/system-owner.entity');
    const systemOwnerRepository = dataSource.getRepository(SystemOwner);
    await systemOwnerRepository
      .createQueryBuilder()
      .delete()
      .where('userId IN (:...userIds)', { userIds: testUserIds })
      .execute();
    
    // Now delete the users
    await userRepository.remove(testUsers);
    console.log(`  ✓ Removed ${testUsers.length} test user(s) and their associated data`);
  } else {
    console.log(`  - No test users found`);
  }

  // Remove CSV sample users so they can be added via CSV upload only
  const csvSampleEmails = [
    'elokusa.zondi@silvertreebrands.com',
    'tarak.pema@silvertreebrands.com',
  ];
  const csvSampleUsers = await userRepository.find({
    where: csvSampleEmails.map((email) => ({ email })),
  });
  if (csvSampleUsers.length > 0) {
    const csvUserIds = csvSampleUsers.map((u) => u.id);

    // Delete access requests for CSV sample users
    try {
      const { AccessRequest } = await import('../access-control/entities/access-request.entity');
      const accessRequestRepository = dataSource.getRepository(AccessRequest);
      await accessRequestRepository
        .createQueryBuilder()
        .delete()
        .where('requesterId IN (:...userIds) OR targetUserId IN (:...userIds)', { userIds: csvUserIds })
        .execute();
    } catch (error) {
      // Ignore if table doesn't exist yet
    }

    await grantRepository
      .createQueryBuilder()
      .delete()
      .where('userId IN (:...userIds)', { userIds: csvUserIds })
      .execute();

    const { SystemOwner } = await import('../ownership/entities/system-owner.entity');
    const systemOwnerRepository = dataSource.getRepository(SystemOwner);
    await systemOwnerRepository
      .createQueryBuilder()
      .delete()
      .where('userId IN (:...userIds)', { userIds: csvUserIds })
      .execute();

    await userRepository.remove(csvSampleUsers);
    console.log(`  ✓ Removed ${csvSampleUsers.length} CSV sample user(s)`);
  }

  // Remove all grants for Gerald Sadya (for demo purposes)
  console.log('Clearing Gerald Sadya access grants...');
  const geraldUser = await userRepository.findOne({
    where: { email: 'geralds@silvertreebrands.com' },
  });
  if (geraldUser) {
    // Delete access requests for Gerald
    try {
      const { AccessRequest } = await import('../access-control/entities/access-request.entity');
      const accessRequestRepository = dataSource.getRepository(AccessRequest);
      await accessRequestRepository
        .createQueryBuilder()
        .delete()
        .where('requesterId = :userId OR targetUserId = :userId', { userId: geraldUser.id })
        .execute();
    } catch (error) {
      // Ignore if table doesn't exist yet
    }

    // Delete all grants for Gerald
    await grantRepository
      .createQueryBuilder()
      .delete()
      .where('userId = :userId', { userId: geraldUser.id })
      .execute();
    
    console.log(`  ✓ Cleared all access grants for Gerald Sadya`);
  } else {
    console.log(`  - Gerald Sadya not found`);
  }

  // Clean up test systems (keep only real Silvertree systems)
  console.log('Cleaning up test systems...');
  const validSystemNames = seedSystems.map(s => s.name);
  const allSystems = await systemRepository.find();
  const testSystems = allSystems.filter(s => !validSystemNames.includes(s.name));
  
  if (testSystems.length > 0) {
    const testSystemIds = testSystems.map(s => s.id);
    
    // Get all instances for test systems first
    const testInstances = await instanceRepository.find({
      where: testSystemIds.map(id => ({ systemId: id })),
    });
    const testInstanceIds = testInstances.map(i => i.id);
    
    // Delete access grants for test systems
    if (testInstanceIds.length > 0) {
      await grantRepository
        .createQueryBuilder()
        .delete()
        .where('systemInstanceId IN (:...instanceIds)', { instanceIds: testInstanceIds })
        .execute();
    }
    
    // Delete access request items for test systems
    if (testInstanceIds.length > 0) {
      try {
        const { AccessRequestItem } = await import('../access-control/entities/access-request.entity');
        const accessRequestItemRepository = dataSource.getRepository(AccessRequestItem);
        await accessRequestItemRepository
          .createQueryBuilder()
          .delete()
          .where('systemInstanceId IN (:...instanceIds)', { instanceIds: testInstanceIds })
          .execute();
      } catch (error) {
        // Ignore if table doesn't exist yet
      }
    }
    
    // Delete system owners for test systems
    const { SystemOwner } = await import('../ownership/entities/system-owner.entity');
    const systemOwnerRepository = dataSource.getRepository(SystemOwner);
    await systemOwnerRepository
      .createQueryBuilder()
      .delete()
      .where('systemId IN (:...systemIds)', { systemIds: testSystemIds })
      .execute();
    
    // Delete instances and tiers for test systems
    await instanceRepository
      .createQueryBuilder()
      .delete()
      .where('systemId IN (:...systemIds)', { systemIds: testSystemIds })
      .execute();
    
    await tierRepository
      .createQueryBuilder()
      .delete()
      .where('systemId IN (:...systemIds)', { systemIds: testSystemIds })
      .execute();
    
    // Delete the test systems
    await systemRepository.remove(testSystems);
    console.log(`  ✓ Removed ${testSystems.length} test system(s) and their associated data`);
  } else {
    console.log(`  - No test systems found`);
  }

  // Seed Users
  console.log('Creating users...');
  const users: User[] = [];
  for (const userData of seedUsers) {
    const existingUser = await userRepository.findOne({ where: { email: userData.email } });
    if (!existingUser) {
      const user = userRepository.create(userData);
      const savedUser = await userRepository.save(user);
      users.push(savedUser);
      console.log(`  ✓ Created user: ${userData.name} (${userData.email})`);
    } else {
      users.push(existingUser);
      console.log(`  - User already exists: ${userData.email}`);
    }
  }

  // Seed Systems
  console.log('Creating systems...');
  const systems: System[] = [];
  for (const systemData of seedSystems) {
    const existingSystem = await systemRepository.findOne({ where: { name: systemData.name } });
    if (!existingSystem) {
      const system = systemRepository.create(systemData);
      const savedSystem = await systemRepository.save(system);
      systems.push(savedSystem);
      console.log(`  ✓ Created system: ${systemData.name}`);
    } else {
      systems.push(existingSystem);
      console.log(`  - System already exists: ${systemData.name}`);
    }
  }

  // Seed System Instances
  console.log('Creating system instances...');
  const instances: SystemInstance[] = [];
  
  // Define instances per system (brand-specific)
  const systemInstances: Record<string, Array<{ name: string; region: string; environment?: string }>> = {
    'Magento': [
      { name: 'UCOOK Production', region: 'ZA', environment: 'production' },
      { name: 'Faithful to Nature Production', region: 'ZA', environment: 'production' },
      { name: 'PetHeaven Production', region: 'ZA', environment: 'production' },
      { name: 'UCOOK Staging', region: 'ZA', environment: 'staging' },
    ],
    'Acumatica': [
      { name: 'Production', region: 'ZA', environment: 'production' },
      { name: 'Staging', region: 'ZA', environment: 'staging' },
      { name: 'Development', region: 'ZA', environment: 'development' },
    ],
    'Google Analytics': [
      { name: 'Production', region: 'Global', environment: 'production' },
      { name: 'Staging', region: 'Global', environment: 'staging' },
    ],
    'Zoho People': [
      { name: 'Production', region: 'ZA', environment: 'production' },
      { name: 'Staging', region: 'ZA', environment: 'staging' },
    ],
    'Shopify': [
      { name: 'SKOON Production', region: 'ZA', environment: 'production' },
      { name: 'SKOON Staging', region: 'ZA', environment: 'staging' },
    ],
  };
  
  for (const system of systems) {
    const systemInstanceConfigs = systemInstances[system.name] || [
      { name: 'Production', region: 'ZA', environment: 'production' },
    ];
    
    for (const instanceConfig of systemInstanceConfigs) {
      const existingInstance = await instanceRepository.findOne({
        where: { systemId: system.id, name: instanceConfig.name },
      });
      if (!existingInstance) {
        const instance = instanceRepository.create({
          systemId: system.id,
          name: instanceConfig.name,
          region: instanceConfig.region,
          environment: instanceConfig.environment,
        });
        const savedInstance = await instanceRepository.save(instance);
        instances.push(savedInstance);
        console.log(`  ✓ Created instance: ${instanceConfig.name} for ${system.name}`);
      } else {
        instances.push(existingInstance);
      }
    }
  }

  // Seed Access Tiers
  console.log('Creating access tiers...');
  const tiers: AccessTier[] = [];
  
  // Define access tiers per system (system-specific)
  const systemTiers: Record<string, Array<{ name: string; description: string }>> = {
    'Magento': [
      { name: 'Viewer', description: 'Read-only access to products and orders' },
      { name: 'Editor', description: 'Can edit products, manage inventory, and process orders' },
      { name: 'Admin', description: 'Full administrative access including settings and user management' },
    ],
    'Acumatica': [
      { name: 'Viewer', description: 'Read-only access to financial reports and data' },
      { name: 'Accountant', description: 'Can create and edit journal entries and financial transactions' },
      { name: 'Admin', description: 'Full system administration including user management and configuration' },
    ],
    'Google Analytics': [
      { name: 'Viewer', description: 'Read-only access to reports and dashboards' },
      { name: 'Analyst', description: 'Can create custom reports and segments' },
      { name: 'Admin', description: 'Full access including account management and user permissions' },
    ],
    'Zoho People': [
      { name: 'Employee', description: 'Standard employee access to own profile and leave requests' },
      { name: 'Manager', description: 'Can view team members and approve leave requests' },
      { name: 'HR Admin', description: 'Full HR administration including employee management and reporting' },
    ],
    'Shopify': [
      { name: 'Viewer', description: 'Read-only access to store and products' },
      { name: 'Staff', description: 'Can manage products, orders, and customers' },
      { name: 'Admin', description: 'Full store administration including settings and apps' },
    ],
  };
  
  for (const system of systems) {
    const tierConfigs = systemTiers[system.name] || [
      { name: 'Viewer', description: 'Read-only access' },
      { name: 'Admin', description: 'Full administrative access' },
    ];
    
    for (const tierConfig of tierConfigs) {
      const existingTier = await tierRepository.findOne({
        where: { systemId: system.id, name: tierConfig.name },
      });
      if (!existingTier) {
        const tier = tierRepository.create({
          systemId: system.id,
          name: tierConfig.name,
          description: tierConfig.description,
        });
        const savedTier = await tierRepository.save(tier);
        tiers.push(savedTier);
        console.log(`  ✓ Created tier: ${tierConfig.name} for ${system.name}`);
      } else {
        tiers.push(existingTier);
      }
    }
  }

  // Seed Access Grants - give each user at least 1 access grant
  console.log('Creating access grants...');
  const allInstances = await instanceRepository.find({ relations: ['system'] });
  const allTiers = await tierRepository.find({ relations: ['system'] });
  
  // Group instances and tiers by system
  const instancesBySystem: Record<string, SystemInstance[]> = {};
  const tiersBySystem: Record<string, AccessTier[]> = {};
  
  allInstances.forEach(inst => {
    if (!instancesBySystem[inst.systemId]) {
      instancesBySystem[inst.systemId] = [];
    }
    instancesBySystem[inst.systemId].push(inst);
  });
  
  allTiers.forEach(tier => {
    if (!tiersBySystem[tier.systemId]) {
      tiersBySystem[tier.systemId] = [];
    }
    tiersBySystem[tier.systemId].push(tier);
  });
  
  // Assign grants to users - give each user access to different systems
  const grantAssignments = [
    { userIndex: 0, systemName: 'Magento', instanceName: 'UCOOK Production', tierName: 'Admin' }, // John Smith - System Owner
    { userIndex: 1, systemName: 'Acumatica', instanceName: 'Production', tierName: 'Admin' }, // Sarah Johnson - Manager
    { userIndex: 2, systemName: 'Magento', instanceName: 'Faithful to Nature Production', tierName: 'Editor' }, // Alex van der Merwe
    { userIndex: 3, systemName: 'Google Analytics', instanceName: 'Production', tierName: 'Analyst' }, // Jane Botha
    { userIndex: 4, systemName: 'Zoho People', instanceName: 'Production', tierName: 'HR Admin' }, // Sipho Ndlovu
    { userIndex: 5, systemName: 'Shopify', instanceName: 'SKOON Production', tierName: 'Staff' }, // Lerato Mthembu
    { userIndex: 6, systemName: 'Magento', instanceName: 'PetHeaven Production', tierName: 'Editor' }, // Gerald Adams
    { userIndex: 7, systemName: 'Acumatica', instanceName: 'Production', tierName: 'Accountant' }, // Emma Wilson
    { userIndex: 8, systemName: 'Google Analytics', instanceName: 'Production', tierName: 'Viewer' }, // Michael Chen
    { userIndex: 9, systemName: 'Magento', instanceName: 'UCOOK Staging', tierName: 'Admin' }, // David van Niekerk - Manager
  ];
  
  for (const assignment of grantAssignments) {
    if (assignment.userIndex >= users.length) continue;
    
    const user = users[assignment.userIndex];
    const system = systems.find(s => s.name === assignment.systemName);
    if (!system) continue;
    
    const systemInstances = instancesBySystem[system.id] || [];
    const systemTiers = tiersBySystem[system.id] || [];
    
    const instance = systemInstances.find(inst => inst.name === assignment.instanceName);
    const tier = systemTiers.find(t => t.name === assignment.tierName);
    
    if (instance && tier) {
      // Check if grant already exists
      const existingGrant = await grantRepository.findOne({
        where: {
          userId: user.id,
          systemInstanceId: instance.id,
          accessTierId: tier.id,
          status: AccessGrantStatus.ACTIVE,
        },
      });
      
      if (!existingGrant) {
        const grant = grantRepository.create({
          userId: user.id,
          systemInstanceId: instance.id,
          accessTierId: tier.id,
          status: AccessGrantStatus.ACTIVE,
          grantedAt: new Date(),
          grantedById: users[0].id, // John Smith granted all access
        });
        await grantRepository.save(grant);
        console.log(`  ✓ Created grant for ${user.name}: ${system.name} (${instance.name}) - ${tier.name}`);
      } else {
        console.log(`  - Grant already exists for ${user.name}: ${system.name} (${instance.name}) - ${tier.name}`);
      }
    }
  }

  // Create one removed grant for testing filters
  console.log('Creating removed grant for testing...');
  if (users.length > 1 && allInstances.length > 0 && allTiers.length > 0) {
    // Use a different user than the first one, and find a proper instance/tier
    const removedUser = users[1]; // Sarah Johnson
    const magentoSystem = systems.find(s => s.name === 'Magento');
    
    if (magentoSystem) {
      const magentoInstances = allInstances.filter(inst => inst.systemId === magentoSystem.id);
      const magentoTiers = allTiers.filter(t => t.systemId === magentoSystem.id);
      
      if (magentoInstances.length > 0 && magentoTiers.length > 0) {
        const removedInstance = magentoInstances[0]; // UCOOK Production
        const removedTier = magentoTiers.find(t => t.name === 'Editor') || magentoTiers[0];
        
        // Check if there's already an active grant for this combination
        const existingActiveGrant = await grantRepository.findOne({
          where: {
            userId: removedUser.id,
            systemInstanceId: removedInstance.id,
            accessTierId: removedTier.id,
            status: AccessGrantStatus.ACTIVE,
          },
        });
        
        // Only create removed grant if there's no active one (to avoid conflicts)
        if (!existingActiveGrant) {
          const existingRemovedGrant = await grantRepository.findOne({
            where: {
              userId: removedUser.id,
              systemInstanceId: removedInstance.id,
              accessTierId: removedTier.id,
              status: AccessGrantStatus.REMOVED,
            },
          });
          
          if (!existingRemovedGrant) {
            const removedGrant = grantRepository.create({
              userId: removedUser.id,
              systemInstanceId: removedInstance.id,
              accessTierId: removedTier.id,
              status: AccessGrantStatus.REMOVED,
              grantedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
              removedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
              grantedById: users[0].id,
            });
            await grantRepository.save(removedGrant);
            console.log(`  ✓ Created removed grant for ${removedUser.name}: ${magentoSystem.name} (${removedInstance.name}) - ${removedTier.name}`);
          } else {
            console.log(`  - Removed grant already exists`);
          }
        } else {
          console.log(`  - Active grant exists, skipping removed grant creation`);
        }
      }
    }
  }

  // Seed System Owners
  console.log('Creating system owners...');
  const { SystemOwner } = await import('../ownership/entities/system-owner.entity');
  const systemOwnerRepository = dataSource.getRepository(SystemOwner);
  
  // Make John Smith (users[0]) an owner of all systems
  // This allows him to add grants for any system
  const johnSmith = users.find(u => u.email === 'john.smith@silvertreebrands.com');
  if (johnSmith) {
    for (const system of systems) {
      const existingOwner = await systemOwnerRepository.findOne({
        where: { userId: johnSmith.id, systemId: system.id },
      });
      
      if (!existingOwner) {
        const owner = systemOwnerRepository.create({
          userId: johnSmith.id,
          systemId: system.id,
        });
        await systemOwnerRepository.save(owner);
        console.log(`  ✓ Made ${johnSmith.name} owner of ${system.name}`);
      } else {
        console.log(`  - ${johnSmith.name} already owner of ${system.name}`);
      }
    }
  }
  
  // Also make David van Niekerk (users[9]) an owner of Magento system for testing
  const davidVanNiekerk = users.find(u => u.email === 'david.vanniekerk@silvertreebrands.com');
  if (davidVanNiekerk) {
    const magentoSystem = systems.find(s => s.name === 'Magento');
    if (magentoSystem) {
      const existingOwner = await systemOwnerRepository.findOne({
        where: { userId: davidVanNiekerk.id, systemId: magentoSystem.id },
      });
      
      if (!existingOwner) {
        const owner = systemOwnerRepository.create({
          userId: davidVanNiekerk.id,
          systemId: magentoSystem.id,
        });
        await systemOwnerRepository.save(owner);
        console.log(`  ✓ Made ${davidVanNiekerk.name} owner of ${magentoSystem.name}`);
      } else {
        console.log(`  - ${davidVanNiekerk.name} already owner of ${magentoSystem.name}`);
      }
    }
  }

  console.log('✅ Database seeding completed!');
  console.log(`   Users: ${users.length}`);
  console.log(`   Systems: ${systems.length}`);
  const grantCount = await grantRepository.count();
  console.log(`   Access Grants: ${grantCount}`);
}

