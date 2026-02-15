import User from './src/models/User';
import { syncDatabase } from './src/config/database';

async function resetAdmin() {
  try {
    console.log('🔄 Sincronizando banco de dados...');
    await syncDatabase();

    console.log('🔍 Procurando admin@gmail.com...');
    let user = await User.findOne({ where: { email: 'admin@gmail.com' } });

    if (user) {
      console.log('✏️ Atualizando senha do admin existente...');
      await user.update({ password: 'vip2026' });
      console.log('✅ Senha atualizada para: vip2026');
    } else {
      console.log('➕ Admin não encontrado. Criando novo...');
      user = await User.create({
        email: 'admin@gmail.com',
        password: 'vip2026',
        fullName: 'Admin User',
        role: 'admin',
        plan: 'enterprise',
        isActive: true
      });
      console.log('✅ Admin criado com sucesso!');
    }

    console.log('\n📋 Dados do admin:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Plan: ${user.plan}`);
    console.log(`   Status: ${user.isActive ? 'Ativo' : 'Inativo'}`);
    console.log('\n✨ Tudo pronto! Faça login com:');
    console.log('   Email: admin@gmail.com');
    console.log('   Senha: vip2026');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

resetAdmin();
