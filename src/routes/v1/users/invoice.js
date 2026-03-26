import { Router } from 'express';
import authenticate from '../../../middlewares/authenticate.js';
import {
  createInvoice,
  getAllInvoices,
  editInvoice,
  deleteInvoice,
  markInvoiceAsPaid,
  sendInvoice,
  sendInvoiceReminder,
  downloadInvoicePdf,
} from '../../../controller/v1/users/invoice.js';

const router = Router();

router.post('/create', authenticate('user'), createInvoice);
router.get('/', authenticate('user'), getAllInvoices);
router.put('/:id', authenticate('user'), editInvoice);
router.delete('/:id', authenticate('user'), deleteInvoice);
router.patch('/:id/mark-paid', authenticate('user'), markInvoiceAsPaid);
router.post('/:id/send', authenticate('user'), sendInvoice);
router.post('/:id/send-reminder', authenticate('user'), sendInvoiceReminder);
router.get('/:id/pdf', authenticate('user'), downloadInvoicePdf);

export default router;
