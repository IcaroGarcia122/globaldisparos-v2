import User from './src/models/User';
import { syncDatabase } from './src/config/database';

async function seed() {
  try {
    await syncDatabase();

    // Criar usuário admin de teste
    const existingUser = await User.findOne({ where: { email: 'admin@gmail.com' } });

    if (!existingUser) {
      const admin = await User.create({
        email: 'admin@gmail.com',
        password: 'vip2026',
        fullName: 'Admin User',
        role: 'admin',
        plan: 'enterprise',
        isActive: true
      });
      console.log('✅ Admin criado:', admin.email);
    } else {
      console.log('✅ Admin já existe:', existingUser.email);
    }

    // Criar usuário VIP de teste
    const vipUser = await User.findOne({ where: { email: 'vip@gmail.com' } });

    if (!vipUser) {
      const user = await User.create({
        email: 'vip@gmail.com',
        password: 'vip2026',
        fullName: 'VIP User',
        role: 'user',
        plan: 'pro',
        isActive: true
      });
      console.log('✅ Usuário VIP criado:', user.email);
    } else {
      console.log('✅ Usuário VIP já existe:', vipUser.email);
    }

    console.log('✅ Seed completo!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

seed();
