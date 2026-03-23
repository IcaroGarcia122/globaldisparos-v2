"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordReset = sendPasswordReset;
exports.sendWelcome = sendWelcome;
exports.sendInvite = sendInvite;
const logger_1 = __importDefault(require("../utils/logger"));
async function getResend() {
    const key = process.env.RESEND_API_KEY;
    if (!key || key === 'sua_key_aqui' || key.trim() === '') {
        return null;
    }
    try {
        const { Resend } = require('resend');
        return new Resend(key);
    }
    catch {
        logger_1.default.warn('[Email] Pacote "resend" não instalado — rode: npm install resend');
        return null;
    }
}
const FROM = process.env.EMAIL_FROM || 'GlobalDisparos <onboarding@resend.dev>';
const APP_NAME = 'GlobalDisparos';
const APP_URL = process.env.FRONTEND_URL || 'https://globaldisparos.com.br';
function baseTemplate(content) {
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<style>
body{margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.wrap{max-width:520px;margin:40px auto;padding:0 16px}
.card{background:#1c2433;border-radius:24px;padding:40px;border:1px solid rgba(255,255,255,0.06)}
.logo{text-align:center;margin-bottom:32px;font-size:28px;font-weight:900;letter-spacing:-1px;text-transform:uppercase}
.logo-w{color:#fff}.logo-b{color:#3b82f6}
h1{color:#fff;font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:-.5px;margin:0 0 8px}
p{color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 14px}
.btn{display:block;background:#2563eb;color:#fff!important;text-decoration:none;text-align:center;padding:16px;border-radius:12px;font-weight:900;font-size:13px;text-transform:uppercase;letter-spacing:.08em;margin:24px 0}
hr{border:none;border-top:1px solid rgba(255,255,255,0.06);margin:20px 0}
.warn{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:12px;margin:14px 0}
.warn p{color:#fbbf24;font-size:12px;margin:0}
.link{background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:10px;padding:12px;margin:14px 0;word-break:break-all}
.link a{color:#60a5fa;font-size:12px;font-family:monospace}
.foot{text-align:center;margin-top:20px;color:#475569;font-size:12px}
</style></head><body>
<div class="wrap">
  <div class="logo"><span class="logo-w">GLOBAL</span><br><span class="logo-b">DISPAROS</span></div>
  <div class="card">${content}</div>
  <div class="foot">${APP_NAME} · Todos os direitos reservados</div>
</div></body></html>`;
}
async function send(to, subject, html) {
    const client = await getResend();
    if (!client) {
        logger_1.default.warn(`[Email] Não enviado para ${to} — RESEND_API_KEY não configurada`);
        return false;
    }
    try {
        const { error } = await client.emails.send({ from: FROM, to, subject, html });
        if (error) {
            logger_1.default.error(`[Email] Erro: ${JSON.stringify(error)}`);
            return false;
        }
        logger_1.default.info(`[Email] ✅ Enviado para ${to}: ${subject}`);
        return true;
    }
    catch (err) {
        logger_1.default.error(`[Email] Falha: ${err.message}`);
        return false;
    }
}
async function sendPasswordReset(to, resetLink, name) {
    return send(to, `${APP_NAME} — Redefinição de senha`, baseTemplate(`
    <h1>Redefinição de Senha</h1>
    <p>Olá${name ? `, <strong style="color:#fff">${name}</strong>` : ''}! Recebemos uma solicitação para redefinir sua senha.</p>
    <p>O link abaixo é válido por <strong style="color:#fff">2 horas</strong>.</p>
    <a href="${resetLink}" class="btn">Redefinir Minha Senha</a>
    <div class="warn"><p>⚠️ Se você não solicitou, ignore este email.</p></div>
    <hr>
    <div class="link"><a href="${resetLink}">${resetLink}</a></div>
  `));
}
async function sendWelcome(to, name, plan) {
    const labels = { basic: 'Basic', pro: 'Pro', enterprise: 'Enterprise' };
    return send(to, `Bem-vindo ao ${APP_NAME}!`, baseTemplate(`
    <h1>Bem-vindo!</h1>
    <p>Olá, <strong style="color:#fff">${name}</strong>! Sua conta foi criada no plano <strong style="color:#3b82f6">${labels[plan] ?? plan}</strong>.</p>
    <a href="${APP_URL}/auth" class="btn">Acessar o Painel</a>
  `));
}
async function sendInvite(to, inviteLink, plan, note) {
    if (!to)
        return false;
    const labels = { basic: 'Basic', pro: 'Pro', enterprise: 'Enterprise' };
    return send(to, `Seu convite para o ${APP_NAME}`, baseTemplate(`
    <h1>Você foi convidado!</h1>
    <p>Você recebeu acesso ao plano <strong style="color:#3b82f6">${labels[plan] ?? plan}</strong>.${note ? `<br><em style="color:#64748b">${note}</em>` : ''}</p>
    <a href="${inviteLink}" class="btn">Ativar Meu Acesso</a>
    <div class="warn"><p>⚠️ Link de uso único com validade limitada.</p></div>
    <hr>
    <div class="link"><a href="${inviteLink}">${inviteLink}</a></div>
  `));
}
//# sourceMappingURL=email.service.js.map