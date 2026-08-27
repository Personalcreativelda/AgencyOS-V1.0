import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo agency
  const agency = await prisma.agency.upsert({
    where: { slug: 'agencia-demo' },
    update: {},
    create: {
      name: 'Agência Demo',
      slug: 'agencia-demo',
      country: 'BR',
      timezone: 'America/Sao_Paulo',
      locale: 'pt-BR',
      status: 'ACTIVE',
    },
  });

  // Create owner user
  const passwordHash = await bcrypt.hash('demo1234', 10);
  const owner = await prisma.user.upsert({
    where: { email: 'admin@agencyflow.demo' },
    update: {},
    create: {
      name: 'Admin AgencyFlow',
      email: 'admin@agencyflow.demo',
      passwordHash,
      status: 'ACTIVE',
    },
  });

  // Create manager user
  const manager = await prisma.user.upsert({
    where: { email: 'gerente@agencyflow.demo' },
    update: {},
    create: {
      name: 'Maria Silva',
      email: 'gerente@agencyflow.demo',
      passwordHash,
      status: 'ACTIVE',
    },
  });

  // Add members
  await prisma.agencyMember.upsert({
    where: { agencyId_userId: { agencyId: agency.id, userId: owner.id } },
    update: {},
    create: { agencyId: agency.id, userId: owner.id, role: 'OWNER', status: 'ACTIVE', joinedAt: new Date() },
  });

  await prisma.agencyMember.upsert({
    where: { agencyId_userId: { agencyId: agency.id, userId: manager.id } },
    update: {},
    create: { agencyId: agency.id, userId: manager.id, role: 'MANAGER', status: 'ACTIVE', joinedAt: new Date() },
  });

  // Create demo clients
  const client1 = await prisma.client.upsert({
    where: { agencyId_slug: { agencyId: agency.id, slug: 'bella-moda' } },
    update: {},
    create: {
      agencyId: agency.id,
      name: 'Bella Moda',
      slug: 'bella-moda',
      industry: 'Moda e Vestuário',
      website: 'https://bellamoda.com.br',
      description: 'Loja de moda feminina premium com foco em peças exclusivas e atemporais.',
      email: 'contato@bellamoda.com.br',
      phone: '+55 11 9999-0001',
      country: 'BR',
      city: 'São Paulo',
      status: 'ACTIVE',
      accountManagerId: manager.id,
      startDate: new Date('2026-01-01'),
    },
  });

  const client2 = await prisma.client.upsert({
    where: { agencyId_slug: { agencyId: agency.id, slug: 'tech-solutions' } },
    update: {},
    create: {
      agencyId: agency.id,
      name: 'Tech Solutions',
      slug: 'tech-solutions',
      industry: 'Tecnologia',
      website: 'https://techsolutions.com.br',
      description: 'Empresa de soluções tecnológicas para pequenas e médias empresas.',
      status: 'ACTIVE',
      accountManagerId: owner.id,
      startDate: new Date('2026-02-01'),
    },
  });

  const client3 = await prisma.client.upsert({
    where: { agencyId_slug: { agencyId: agency.id, slug: 'sabor-gourmet' } },
    update: {},
    create: {
      agencyId: agency.id,
      name: 'Sabor Gourmet',
      slug: 'sabor-gourmet',
      industry: 'Gastronomia',
      description: 'Restaurante gourmet especializado em culinária italiana.',
      status: 'ACTIVE',
      startDate: new Date('2026-03-01'),
    },
  });

  // Brand profiles
  await prisma.brandProfile.upsert({
    where: { clientId: client1.id },
    update: {},
    create: {
      agencyId: agency.id,
      clientId: client1.id,
      brandSummary: 'Bella Moda é uma marca de moda feminina premium que combina elegância clássica com tendências contemporâneas.',
      mission: 'Empoderar mulheres através da moda exclusiva e atemporal',
      vision: 'Ser a referência em moda feminina premium no Brasil',
      positioning: 'Premium acessível — qualidade de alto padrão com preços justos',
      targetAudience: 'Mulheres de 28-45 anos, classe A/B, que valorizam qualidade e estilo próprio',
      toneOfVoice: 'Elegante, próximo, inspirador e empoderador',
      brandPersonality: 'Sofisticada, autêntica, confiante',
      defaultCta: 'Descubra sua coleção',
    },
  });

  await prisma.brandProfile.upsert({
    where: { clientId: client2.id },
    update: {},
    create: {
      agencyId: agency.id,
      clientId: client2.id,
      brandSummary: 'Tech Solutions simplifica a tecnologia para empresas que querem crescer.',
      toneOfVoice: 'Técnico mas acessível, confiante, didático',
      targetAudience: 'Empreendedores e gestores de PMEs de 30-50 anos',
    },
  });

  await prisma.brandProfile.upsert({
    where: { clientId: client3.id },
    update: {},
    create: {
      agencyId: agency.id,
      clientId: client3.id,
      brandSummary: 'Sabor Gourmet transforma ingredientes selecionados em experiências gastronômicas únicas.',
      toneOfVoice: 'Apaixonado, sofisticado e acolhedor',
      targetAudience: 'Apreciadores de boa gastronomia, 30-55 anos',
    },
  });

  // Brand rules for client1
  const rules = [
    { ruleType: 'DO', ruleText: 'Usar linguagem elegante e próxima', importance: 9 },
    { ruleType: 'DO', ruleText: 'Mostrar mulheres reais e diversas', importance: 8 },
    { ruleType: 'DONT', ruleText: 'Nunca usar linguagem muito informal ou gírias', importance: 9 },
    { ruleType: 'DONT', ruleText: 'Não focar em preço como único diferencial', importance: 7 },
    { ruleType: 'TONE', ruleText: 'Tom empoderador sem ser arrogante', importance: 8 },
    { ruleType: 'CTA', ruleText: 'CTAs devem ser convidativos, não imperativos', importance: 7 },
  ];

  for (const rule of rules) {
    await prisma.brandRule.create({
      data: { agencyId: agency.id, clientId: client1.id, source: 'MANUAL', ...rule },
    }).catch(() => {});
  }

  // Brand colors
  const colors = [
    { name: 'Rosa Principal', hex: '#D4B8A8', priority: 10 },
    { name: 'Dourado', hex: '#C9A96E', priority: 9 },
    { name: 'Branco', hex: '#FAFAFA', priority: 8 },
    { name: 'Cinza Escuro', hex: '#2C2C2C', priority: 7 },
  ];
  for (const color of colors) {
    await prisma.brandColor.create({
      data: { agencyId: agency.id, clientId: client1.id, ...color },
    }).catch(() => {});
  }

  // Pillars
  const pillars = [
    { name: 'Moda & Estilo', description: 'Tendências, looks e inspirações', percentageTarget: 35 },
    { name: 'Empoderamento', description: 'Conteúdo inspirador para mulheres', percentageTarget: 25 },
    { name: 'Produto', description: 'Destaque de peças e coleções', percentageTarget: 25 },
    { name: 'Social Proof', description: 'Depoimentos e clientes usando a marca', percentageTarget: 15 },
  ];
  for (const pillar of pillars) {
    await prisma.brandContentPillar.create({
      data: { agencyId: agency.id, clientId: client1.id, status: 'ACTIVE', ...pillar },
    }).catch(() => {});
  }

  // Create a calendar + some contents
  const now = new Date();
  const calendar = await prisma.contentCalendar.upsert({
    where: { clientId_month_year: { clientId: client1.id, month: now.getMonth() + 1, year: now.getFullYear() } },
    update: {},
    create: {
      agencyId: agency.id,
      clientId: client1.id,
      name: `Calendário ${now.toLocaleString('pt-BR', { month: 'long' })} ${now.getFullYear()}`,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      status: 'ACTIVE',
      createdById: owner.id,
    },
  });

  const sampleContents = [
    { title: 'Look do dia — Coleção Verão', contentType: 'IMAGE', status: 'APPROVED', hook: 'O look perfeito para o seu verão', caption: 'Verão chegou e trouxe cores, leveza e muita atitude! ☀️\n\nEssa combinação é pura elegância casual — perfeita para qualquer ocasião.\n\n💛 Qual é o seu look favorito do verão?\n\n#BellaModa #Moda #Verão2026', scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) },
    { title: 'Post Empoderamento — Segunda-feira', contentType: 'REEL', status: 'CLIENT_REVIEW', hook: 'Você merece se sentir incrível todos os dias', caption: 'Segunda-feira é o melhor dia para começar a semana com estilo! 💪\n\nA roupa certa muda tudo — e a gente sabe que você merece o melhor.\n\n✨ O que te faz sentir confiante?\n\n#BellaModa #Empoderamento #MondayMotivation' },
    { title: 'Novidade — Nova Coleção', contentType: 'CAROUSEL', status: 'DRAFT', hook: 'Novidades que vão apaixonar você', caption: 'NOVIDADE CHEGANDO! 🎉\n\nNossa nova coleção está prestes a chegar e você vai adorar cada detalhe.\n\nSalva esse post para não perder o lançamento! 💾' },
    { title: 'Depoimento — Cliente Feliz', contentType: 'IMAGE', status: 'CHANGES_REQUESTED', hook: 'Veja o que nossa cliente disse', caption: '"A qualidade é impressionante e o atendimento é perfeito!" — Ana P., cliente há 2 anos\n\n💬 Nada nos motiva mais do que ver vocês felizes!\n\n#BellaModa #SocialProof #ClienteFeliz' },
    { title: 'Story — Enquete Look', contentType: 'STORY', status: 'DRAFT' },
  ];

  const pillarList = await prisma.brandContentPillar.findMany({ where: { clientId: client1.id } });

  for (let i = 0; i < sampleContents.length; i++) {
    const c = sampleContents[i];
    await prisma.content.create({
      data: {
        agencyId: agency.id,
        clientId: client1.id,
        calendarId: calendar.id,
        contentPillarId: pillarList[i % pillarList.length]?.id,
        title: c.title,
        contentType: c.contentType,
        hook: (c as any).hook,
        caption: (c as any).caption,
        status: c.status,
        priority: 'MEDIUM',
        scheduledAt: (c as any).scheduledAt || null,
        createdById: owner.id,
        assignedToId: i % 2 === 0 ? manager.id : owner.id,
      },
    });
  }

  console.log('\n✅ Database seeded successfully!\n');
  console.log('🔐 Login credentials:');
  console.log('   Email: admin@agencyflow.demo');
  console.log('   Password: demo1234\n');
  console.log('   Email: gerente@agencyflow.demo');
  console.log('   Password: demo1234\n');
  console.log('🌐 Start the server: npm run dev:api');
  console.log('🌐 Start the frontend: npm run dev:web\n');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('❌ Seed error:', e);
    prisma.$disconnect();
    process.exit(1);
  });
