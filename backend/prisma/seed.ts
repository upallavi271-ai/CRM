import { PrismaClient, CustomFieldType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

const MODULES = [
  'User',
  'Role',
  'Customer',
  'CustomField',
  'Lead',
  'Deal',
  'Ticket',
  'Report',
  'AuditLog',
];
const ACTIONS = ['Create', 'Read', 'Update', 'Delete'];

const crud = (module: string, actions = ACTIONS) =>
  actions.map((a) => `${module}.${a}`);

// Permissions beyond CRUD. *.ReadAll = see everyone's records (otherwise only your own).
const EXTRA_PERMISSIONS = [
  'Lead.ReadAll',
  'Lead.Assign',
  'Lead.Convert',
  'Deal.ReadAll',
];

const ROLES: Record<
  string,
  { description: string; permissions: string[] | 'ALL' }
> = {
  Admin: { description: 'Full access', permissions: 'ALL' },
  'Sales Manager': {
    description: 'Manages the sales team',
    permissions: [
      ...crud('Customer'),
      ...crud('Lead'),
      ...crud('Deal'),
      ...EXTRA_PERMISSIONS,
      'CustomField.Read',
      'Report.Read',
      'User.Read',
    ],
  },
  'Sales Executive': {
    description: 'Works own leads and deals',
    permissions: [
      ...crud('Customer', ['Create', 'Read', 'Update']),
      ...crud('Lead', ['Create', 'Read', 'Update']),
      ...crud('Deal', ['Create', 'Read', 'Update']),
      'Lead.Convert',
      'CustomField.Read',
    ],
  },
  'Support Agent': {
    description: 'Handles tickets',
    permissions: [
      ...crud('Customer', ['Read', 'Update']),
      ...crud('Ticket'),
      'CustomField.Read',
    ],
  },
};

async function main() {
  // Permissions (global)
  const allKeys = [...MODULES.flatMap((m) => crud(m)), ...EXTRA_PERMISSIONS];
  for (const key of allKeys) {
    const [module, action] = key.split('.');
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, module, action },
    });
  }
  const permissions = await prisma.permission.findMany();
  const permIdByKey = new Map(permissions.map((p) => [p.key, p.id]));

  // Tenant
  let tenant = await prisma.tenant.findFirst({
    where: { name: 'Demo Company' },
  });
  if (!tenant)
    tenant = await prisma.tenant.create({ data: { name: 'Demo Company' } });

  // Roles + role_permission
  const roleIds: Record<string, string> = {};
  for (const [name, def] of Object.entries(ROLES)) {
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: { description: def.description },
      create: { tenantId: tenant.id, name, description: def.description },
    });
    roleIds[name] = role.id;
    const keys = def.permissions === 'ALL' ? allKeys : def.permissions;
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: keys.map((k) => ({
        roleId: role.id,
        permissionId: permIdByKey.get(k)!,
      })),
    });
  }

  // Admin user
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@demo.test';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Admin',
      email,
      passwordHash: await bcrypt.hash(password, 10),
      roleId: roleIds.Admin,
    },
  });

  // Sales executive user (to see how a limited role looks)
  const salesEmail = process.env.SEED_SALES_EMAIL ?? 'sales@demo.test';
  const sales = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: salesEmail } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Ravi (Sales)',
      email: salesEmail,
      passwordHash: await bcrypt.hash(password, 10),
      roleId: roleIds['Sales Executive'],
    },
  });

  // Sample CRM fields
  const fieldCount = await prisma.customField.count({
    where: { tenantId: tenant.id },
  });
  if (fieldCount === 0) {
    const fields: {
      name: string;
      key: string;
      type: CustomFieldType;
      color: string;
      options?: string[];
    }[] = [
      { name: 'City', key: 'city', type: 'TEXT', color: '#3b82f6' },
      { name: 'Lifetime Value', key: 'ltv', type: 'NUMBER', color: '#16a34a' },
      {
        name: 'Source',
        key: 'source',
        type: 'SELECT',
        color: '#f59e0b',
        options: ['Website', 'Google Ads', 'Instagram', 'Referral'],
      },
    ];
    await prisma.customField.createMany({
      data: fields.map((f, i) => ({ ...f, tenantId: tenant.id, position: i })),
    });
  }

  // Sample customers
  const customerCount = await prisma.customer.count({
    where: { tenantId: tenant.id },
  });
  if (customerCount === 0) {
    await prisma.customer.createMany({
      data: [
        {
          tenantId: tenant.id,
          name: 'Ramesh Kumar',
          email: 'ramesh@example.com',
          phone: '+91 98480 11111',
          tags: ['VIP'],
          customFields: {
            city: 'Hyderabad',
            ltv: 500000,
            source: 'Google Ads',
          },
        },
        {
          tenantId: tenant.id,
          name: 'Suresh Reddy',
          email: 'suresh@example.com',
          phone: '+91 98480 22222',
          tags: ['Referral'],
          customFields: { city: 'Vijayawada', ltv: 120000, source: 'Referral' },
        },
        {
          tenantId: tenant.id,
          name: 'Lakshmi Devi',
          email: 'lakshmi@example.com',
          phone: '+91 98480 33333',
          tags: [],
          customFields: { city: 'Warangal', source: 'Instagram' },
        },
      ],
    });
  }

  // Default sales pipeline (stages are data, not code)
  let pipeline = await prisma.pipeline.findFirst({
    where: { tenantId: tenant.id, isDefault: true },
    include: { stages: { orderBy: { position: 'asc' } } },
  });
  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        tenantId: tenant.id,
        name: 'Sales Pipeline',
        isDefault: true,
        stages: {
          create: [
            {
              name: 'Discovery',
              position: 0,
              probability: 10,
              color: '#3b82f6',
            },
            {
              name: 'Proposal',
              position: 1,
              probability: 40,
              color: '#8b5cf6',
            },
            {
              name: 'Negotiation',
              position: 2,
              probability: 70,
              color: '#f59e0b',
            },
            {
              name: 'Won',
              position: 3,
              probability: 100,
              type: 'WON',
              color: '#16a34a',
            },
            {
              name: 'Lost',
              position: 4,
              probability: 0,
              type: 'LOST',
              color: '#ef4444',
            },
          ],
        },
      },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
  }
  const stage = Object.fromEntries(pipeline.stages.map((st) => [st.name, st]));

  // Sample leads
  if ((await prisma.lead.count({ where: { tenantId: tenant.id } })) === 0) {
    await prisma.lead.createMany({
      data: [
        {
          tenantId: tenant.id,
          name: 'Anil Varma',
          phone: '+91 99890 10001',
          email: 'anil@example.com',
          source: 'Website',
          status: 'NEW',
          requirement: '2BHK full interior',
          estimatedValue: 350000,
          score: 40,
          assignedToId: sales.id,
        },
        {
          tenantId: tenant.id,
          name: 'Kavya Rao',
          phone: '+91 99890 10002',
          company: 'Rao Clinics',
          source: 'Google Ads',
          status: 'CONTACTED',
          requirement: 'Clinic reception redesign',
          estimatedValue: 600000,
          score: 60,
          assignedToId: sales.id,
        },
        {
          tenantId: tenant.id,
          name: 'Mahesh Babu',
          phone: '+91 99890 10003',
          source: 'Instagram',
          status: 'QUALIFIED',
          requirement: 'Modular kitchen, 2 months',
          estimatedValue: 250000,
          score: 80,
          assignedToId: admin.id,
        },
        {
          tenantId: tenant.id,
          name: 'Sneha Patel',
          email: 'sneha@example.com',
          source: 'Referral',
          status: 'NEW',
          requirement: 'Villa interiors',
          estimatedValue: 1500000,
          score: 30,
        },
        {
          tenantId: tenant.id,
          name: 'Rahul Jain',
          phone: '+91 99890 10005',
          source: 'Website',
          status: 'DISQUALIFIED',
          disqualifyReason: 'Budget too low',
          score: 10,
          assignedToId: sales.id,
        },
      ],
    });
  }

  // Sample deals
  if ((await prisma.deal.count({ where: { tenantId: tenant.id } })) === 0) {
    const customers = await prisma.customer.findMany({
      where: { tenantId: tenant.id },
    });
    const cust = (name: string) =>
      customers.find((c) => c.name.startsWith(name))?.id;
    const inDays = (d: number) => new Date(Date.now() + d * 86400000);
    await prisma.deal.createMany({
      data: [
        {
          title: 'Ramesh Home Interior',
          value: 500000,
          stageId: stage.Negotiation.id,
          customerId: cust('Ramesh'),
          ownerId: sales.id,
          expectedCloseDate: inDays(10),
        },
        {
          title: 'Suresh Office Cabins',
          value: 320000,
          stageId: stage.Proposal.id,
          customerId: cust('Suresh'),
          ownerId: sales.id,
          expectedCloseDate: inDays(25),
        },
        {
          title: 'Lakshmi Kitchen Upgrade',
          value: 180000,
          stageId: stage.Discovery.id,
          customerId: cust('Lakshmi'),
          ownerId: admin.id,
          expectedCloseDate: inDays(40),
        },
        {
          title: 'Ramesh Annual Maintenance',
          value: 45000,
          stageId: stage.Won.id,
          customerId: cust('Ramesh'),
          ownerId: sales.id,
          closedAt: new Date(),
        },
        {
          title: 'Showroom Lighting',
          value: 90000,
          stageId: stage.Lost.id,
          ownerId: admin.id,
          closedAt: new Date(),
          lostReason: 'Chose a cheaper vendor',
        },
      ].map((d) => ({ ...d, tenantId: tenant.id, pipelineId: pipeline.id })),
    });
  }

  console.log(
    `Seed done. Tenant "${tenant.name}", admin login: ${email} (password from SEED_ADMIN_PASSWORD)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
