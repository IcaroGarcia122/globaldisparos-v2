import User from './src/models/User';
import { syncDatabase } from './src/config/database';
import bcrypt from 'bcryptjs';

async function setup() {
  try {
    console.log('📊 Conectando ao banco de dados...');
    await syncDatabase();
    console.log('✅ Banco conectado!\n');

    console.log('🔄 Sincronizando tabelas...');
    // Sequelize já sincronizou tudo no syncDatabase()

    console.log('📝 Preparando usuários de teste...\n');

    // Deletar usuários antigos para garantir limpeza
    await User.destroy({ where: {} });
    console.log('🗑️  Usuários antigos removidos');

    // Criar ADMIN
    const adminData = {
      email: 'admin@gmail.com',
      password: 'vip2026', // Será hasheado automaticamente
      fullName: 'Admin User',
      role: 'admin' as const,
      plan: 'enterprise' as const,
      isActive: true
    };

    const admin = await User.create(adminData);
    console.log(`✅ Admin criado:
   📧 Email: ${admin.email}
   🔑 Senha: vip2026
   👤 Role: ${admin.role}
   📦 Plan: ${admin.plan}\n`);

    // Criar VIP
    const vipData = {
      email: 'vip@gmail.com',
      password: 'vip2026', // Será hasheado automaticamente
      fullName: 'VIP User',
      role: 'user' as const,
      plan: 'pro' as const,
      isActive: true
    };

    const vip = await User.create(vipData);
    console.log(`✅ Usuário VIP criado:
   📧 Email: ${vip.email}
   🔑 Senha: vip2026
   👤 Role: ${vip.role}
   📦 Plan: ${vip.plan}\n`);

    // Criar USER normal
    const userData = {
      email: 'user@gmail.com',
      password: 'user2026',
      fullName: 'Regular User',
      role: 'user' as const,
      plan: 'free' as const,
      isActive: true
    };

    const user = await User.create(userData);
    console.log(`✅ Usuário comum criado:
   📧 Email: ${user.email}
   🔑 Senha: user2026
   👤 Role: ${user.role}
   📦 Plan: ${user.plan}\n`);

    console.log('═══════════════════════════════════════');
    console.log('✨ SETUP COMPLETO! Use as credenciais:\n');
    console.log('🛡️  ADMIN (Painel Gerencial):');
    console.log('   📧 Email: admin@gmail.com');
    console.log('   🔑 Senha: vip2026\n');
    console.log('👑 VIP (Disparador Elite):');
    console.log('   📧 Email: vip@gmail.com');
    console.log('   🔑 Senha: vip2026\n');
    console.log('👤 USER (Teste):');
    console.log('   📧 Email: user@gmail.com');
    console.log('   🔑 Senha: user2026');
    console.log('═══════════════════════════════════════\n');

    // Verificar se consegue fazer login
    console.log('🔍 Testando capacidade de login...');
    const testUser = await User.findOne({ where: { email: 'admin@gmail.com' } });
    if (testUser) {
      const passwordMatch = await testUser.comparePassword('vip2026');
      console.log(passwordMatch ? '✅ Login funcionando!\n' : '❌ Erro na comparação de senha\n');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ ERRO:', error.message);
    console.error('\nDicas:');
    console.error('  1. Certifique-se que PostgreSQL está rodando');
    console.error('  2. Verifique as credenciais no .env');
    console.error('  3. Confirme que o banco "whatsapp_saas" existe');
    process.exit(1);
  }
}

setup();
