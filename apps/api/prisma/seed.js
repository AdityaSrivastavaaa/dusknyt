import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import QRCode from 'qrcode';

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
  const mkPromoter = (brand, phone, name, instagram) => prisma.user.create({
    data: { role: 'PROMOTER', phone, name, passwordHash: hash('Promo@123'), promoter: { create: { brand, company: brand, instagram } } }, include: { promoter: true },
  });
  const aarav = (await mkPromoter('Aarav Promotions', '+919876543210', 'Aarav Sharma', '@aaravpromotions')).promoter;
  const rohan = (await mkPromoter('Rohan Nights', '+919876500001', 'Rohan Mehta', '@rohannights')).promoter;
  const promoters = [
    aarav,
    rohan,
    (await mkPromoter('Neha Guestlists', '+919876500002', 'Neha Kapoor', '@nehaguestlists')).promoter,
    (await mkPromoter('Vikram Social', '+919876500003', 'Vikram Singh', '@vikramsocial')).promoter,
    (await mkPromoter('Maya Nights', '+919876500004', 'Maya Khanna', '@mayanights')).promoter,
  ];
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
  const offers = [];
  const offerVariants = [
    { type: 'Free Entry', entry: 'Couple', price: 0, before: '10:30 PM', types: ['Couple'] },
    { type: 'Cover Charge', entry: 'Couple', price: 1000, before: '11:30 PM', types: ['Couple'] },
    { type: 'Ladies Night', entry: 'Ladies', price: 0, before: '11:00 PM', types: ['Ladies'] },
    { type: 'Stag Entry', entry: 'Stag', price: 1500, before: '10:00 PM', types: ['Stag'] },
    { type: 'Free Entry', entry: 'Group', price: 0, before: '10:45 PM', types: ['Couple', 'Ladies'] },
  ];
  // Every club has multiple upcoming dates, and every event/date has offers from all promoters.
  for (let clubIndex = 0; clubIndex < clubs.length; clubIndex++) {
    for (let eventOffset = 0; eventOffset < 2; eventOffset++) {
      const eventIndex = clubIndex * 2 + eventOffset;
      const eventDate = events[eventIndex].date;
      for (let promoterIndex = 0; promoterIndex < promoters.length; promoterIndex++) {
        const v = offerVariants[promoterIndex];
        offers.push(await mkOffer(clubIndex, eventIndex, promoters[promoterIndex], v.type, v.types.join(', '), v.price, v.before, eventDate, {
          entryTypes: v.types,
          entryType: v.types.join(', '),
          entryFrom: '9:00 PM',
          inclusions: promoterIndex % 2 === 0 ? ['Priority entry', 'Welcome drink', 'Dedicated guestlist counter'] : ['Complimentary entry', 'Skip the line', 'Table access subject to availability'],
          terms: `Offer by ${promoters[promoterIndex].brand}. Valid for ${v.types.join(' and ')} before ${v.before}. Venue dress code applies.`,
        }));
      }
    }
  }

  const mkReq = (offer, status, n, extra = {}) => prisma.guestRequest.create({
    data: {
      code: 'DN' + Math.floor(10000000 + Math.random() * 90000000), userId: demoUser.id, offerId: offer.id, guestCount: n, status,
      guests: Array.from({ length: n }, (_, i) => ({ name: i ? 'Priya Verma' : 'Aditya Verma', gender: i ? 'Female' : 'Male' })), ...extra,
    },
  });
  await mkReq(offers[0], 'PENDING', 2);
  await mkReq(offers[6], 'PENDING', 4);
  await mkReq(offers[12], 'REJECTED', 3, { rejectReason: 'Capacity Full' });
  const confirmed = await mkReq(offers[1], 'CONFIRMED', 2);
  await prisma.guestRequest.update({
    where: { id: confirmed.id },
    data: { qrCode: await QRCode.toDataURL(JSON.stringify({ code: confirmed.code, id: confirmed.id }), { margin: 1, width: 280 }) },
  });
  await prisma.saved.createMany({ data: [
    { userId: demoUser.id, clubId: clubs[2].id },
    { userId: demoUser.id, offerId: offers[1].id },
  ] });
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
  console.log('Seeded.\n  Admin:      admin@dusknyt.com / Admin@123\n  Promoters:  9876543210, 9876500001, 9876500002, 9876500003, 9876500004 / Promo@123\n  Guest:      9999999999 (OTP in dev: 123456)\n  Fixture:    5 clubs, 10 events, 50 offers (5 promoters per event/date), pending/confirmed/rejected requests, QR pass, and saved club/offer.');
}
main().finally(() => prisma.$disconnect());
