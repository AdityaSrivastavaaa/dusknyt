import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const hash = (p) => bcrypt.hashSync(p, 10);
const day = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d; };

async function main() {
  // Fresh seed (dev only)
  await prisma.$transaction([
    prisma.activityLog.deleteMany(), prisma.notification.deleteMany(), prisma.saved.deleteMany(), prisma.guestRequest.deleteMany(),
    prisma.payout.deleteMany(), prisma.offer.deleteMany(), prisma.event.deleteMany(), prisma.club.deleteMany(), prisma.ticket.deleteMany(),
    prisma.promoter.deleteMany(), prisma.user.deleteMany(), prisma.city.deleteMany(), prisma.setting.deleteMany(), prisma.roleDef.deleteMany(),
  ]);

  const names = ['Delhi', 'Mumbai', 'Bangalore', 'Pune', 'Hyderabad', 'Goa'];
  const cities = {};
  for (const [i, name] of names.entries()) cities[name] = await prisma.city.create({ data: { name, isPopular: i < 6 } });

  await prisma.user.create({ data: { role: 'SUPER_ADMIN', email: 'admin@dusknyt.com', name: 'Super Admin', passwordHash: hash('Admin@123') } });
  const mkPromoter = (brand, phone, name) => prisma.user.create({
    data: { role: 'PROMOTER', phone, name, passwordHash: hash('Promo@123'), promoter: { create: { brand, company: brand } } }, include: { promoter: true },
  });
  const aarav = (await mkPromoter('Aarav Promotions', '+919876543210', 'Aarav Sharma')).promoter;
  const rohan = (await mkPromoter('Rohan Nights', '+919876500001', 'Rohan Mehta')).promoter;
  const demoUser = await prisma.user.create({ data: { role: 'USER', phone: '+919999999999', name: 'Aditya Verma', email: 'aditya@email.com' } });

  const clubData = [
    ['Kitty Su', 'The Lalit, Connaught Place, Delhi', 'Connaught Place', 4.6, ['EDM', 'Commercial'], 'Smart Casual'],
    ['Privee', 'Aerocity, Delhi', 'Aerocity', 4.4, ['Bollywood', 'Hip Hop'], 'Smart Casual'],
    ['Drishya', 'Chanakyapuri, Delhi', 'Chanakyapuri', 4.5, ['EDM', 'Bollywood'], 'Party Wear'],
    ['Raasta', 'Connaught Place, Delhi', 'Connaught Place', 4.2, ['Commercial', 'Hip Hop'], 'Casual'],
    ['Lair', 'Greater Kailash, Delhi', 'Greater Kailash', 4.1, ['EDM'], 'Smart Casual'],
  ];
  const clubs = [];
  for (const [name, address, area, rating, music, dressCode] of clubData) {
    clubs.push(await prisma.club.create({
      data: {
        cityId: cities.Delhi.id, name, address, area, rating, music, dressCode, phone: '+911123456789', email: `info@${name.toLowerCase().replace(/\s/g, '')}.com`,
        about: `${name} is one of Delhi's most talked-about nightlife destinations with world-class sound and an electric atmosphere.`, lat: 28.63, lng: 77.22,
      },
    }));
  }
  const events = [];
  for (const [i, c] of clubs.entries()) {
    events.push(await prisma.event.create({ data: { clubId: c.id, title: 'Bollywood Night', djName: 'DJ Chetas', date: day(i % 2), startTime: '9:00 PM', genre: 'Bollywood' } }));
    events.push(await prisma.event.create({ data: { clubId: c.id, title: 'EDM Night', djName: 'DJ Nucleya', date: day(2 + (i % 3)), startTime: '10:00 PM', genre: 'EDM' } }));
  }
  const mkOffer = (ci, ei, promoter, offerType, entryType, price, before, d, extra = {}) => prisma.offer.create({
    data: {
      clubId: clubs[ci].id, eventId: events[ei].id, promoterId: promoter.id, offerType, entryType, price, entryBefore: before, date: d,
      title: `${offerType} · ${entryType} @ ${clubs[ci].name}`, status: 'ACTIVE',
      inclusions: ['Complimentary entry for couple', 'Skip the line', 'Dedicated guestlist counter'],
      terms: 'Valid for couples only. Entry before the stated time. Dress code applies. Right of admission reserved.', ...extra,
    },
  });
  const offers = [
    await mkOffer(0, 0, aarav, 'Free Entry', 'Couple', 0, '9:00 PM', day(0)),
    await mkOffer(0, 0, rohan, 'Cover Charge', 'Couple', 1000, '11:00 PM', day(0)),
    await mkOffer(0, 0, aarav, 'Stag Entry', 'Stag', 1500, '10:00 PM', day(0)),
    await mkOffer(1, 2, aarav, 'Cover Charge', 'Couple', 1000, '10:00 PM', day(1)),
    await mkOffer(2, 4, rohan, 'Ladies Night', 'Ladies', 0, '9:00 PM', day(2)),
    await mkOffer(3, 6, aarav, 'Stag Entry', 'Stag', 1500, '8:00 PM', day(3)),
    await mkOffer(4, 8, rohan, 'Free Entry', 'Group', 0, '9:30 PM', day(1)),
  ];

  const mkReq = (offer, status, n, extra = {}) => prisma.guestRequest.create({
    data: {
      code: 'DN' + Math.floor(10000000 + Math.random() * 90000000), userId: demoUser.id, offerId: offer.id, guestCount: n, status,
      guests: Array.from({ length: n }, (_, i) => ({ name: i ? 'Priya Verma' : 'Aditya Verma', gender: i ? 'Female' : 'Male' })), ...extra,
    },
  });
  await mkReq(offers[0], 'PENDING', 2);
  await mkReq(offers[3], 'PENDING', 4);
  await mkReq(offers[5], 'REJECTED', 3, { rejectReason: 'Capacity Full' });
  await prisma.notification.create({ data: { userId: demoUser.id, title: 'Welcome to DUSKNYT', body: 'Pick a club and request your guestlist entry.' } });

  await prisma.payout.createMany({ data: [
    { promoterId: aarav.id, amount: 18500, status: 'PAID', paidAt: new Date() }, { promoterId: rohan.id, amount: 12000, status: 'PENDING' },
  ] });
  await prisma.ticket.create({ data: { userId: demoUser.id, subject: 'Issue with request', message: 'My request has been pending for a long time.' } });
  await prisma.roleDef.createMany({ data: [
    { name: 'Super Admin', description: 'All permissions', permissions: ['*'] },
    { name: 'Admin', description: 'Manage clubs, offers, users', permissions: ['clubs', 'offers', 'users'] },
    { name: 'Support', description: 'Requests, users', permissions: ['requests', 'users'] },
    { name: 'Analytics', description: 'View reports only', permissions: ['analytics'] },
  ] });
  await prisma.setting.createMany({ data: [
    { key: 'general', value: { appName: 'DUSKNYT', supportEmail: 'support@dusknyt.com', requestExpiryHours: 24 } },
    { key: 'notifications', value: { email: true, push: true } },
  ] });
  console.log('Seeded.\n  Admin:    admin@dusknyt.com / Admin@123\n  Promoter: 9876543210 / Promo@123  (OTP in dev: 123456)\n  User:     9999999999 (OTP in dev: 123456)');
}
main().finally(() => prisma.$disconnect());
