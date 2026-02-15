import { Router } from 'express';
import { User, Payment } from '../models';
import config from '../config';

const router = Router();

router.post('/diggion', async (req, res) => {
  try {
    const { event, customer_email, amount, transaction_id, metadata } = req.body;
    if (event === 'payment.approved') {
      const user = await User.findOne({ where: { email: customer_email } });
      if (user) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (metadata.duration || 30));
        await user.update({ plan: metadata.plan, planExpiresAt: expiresAt });
        await Payment.create({ userId: user.id, diggionTransactionId: transaction_id, amount, status: 'approved', plan: metadata.plan, planDuration: metadata.duration, expiresAt });
      }
    }
    res.json({ received: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
