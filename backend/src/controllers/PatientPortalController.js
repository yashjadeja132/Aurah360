import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import PatientAuthService from '../services/PatientAuthService.js';
import PatientPortalService from '../services/PatientPortalService.js';
import CrmExtensionsService from '../services/CrmExtensionsService.js';

class PatientPortalController {
  constructor() {
    this.auth = new PatientAuthService();
    this.portal = new PatientPortalService();
    this.crm = new CrmExtensionsService();
  }

  /** Patient-facing offer board (§12.5, CRM-001) — only currently valid, active offers. */
  listOffers = asyncHandler(async (req, res) => {
    const offers = await this.crm.listOffers({ activeOnly: 'true' });
    return ApiResponse.success(res, { message: 'Offers retrieved', data: { offers } });
  });

  #pid(req) {
    return req.patientAuth.patientId;
  }

  login = asyncHandler(async (req, res) => {
    const data = await this.auth.login(req.body, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    }, req);
    return ApiResponse.success(res, { message: 'Logged in', data });
  });

  refresh = asyncHandler(async (req, res) => {
    const token = req.body.refreshToken || req.cookies?.patient_refresh_token;
    const data = await this.auth.refresh(token, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    return ApiResponse.success(res, { data });
  });

  logout = asyncHandler(async (req, res) => {
    const token = req.body.refreshToken || req.cookies?.patient_refresh_token;
    const data = await this.auth.logout(token, req.patientAuth?.patientId, req);
    return ApiResponse.success(res, { message: 'Logged out', data });
  });

  forgotPassword = asyncHandler(async (req, res) => {
    const data = await this.auth.forgotPassword(req.body);
    return ApiResponse.success(res, { data });
  });

  requestOtp = asyncHandler(async (req, res) => {
    const data = await this.auth.requestOtp(req.body.mobile, req);
    return ApiResponse.success(res, { message: 'OTP requested', data });
  });

  otpLogin = asyncHandler(async (req, res) => {
    const data = await this.auth.otpLogin(req.body, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    }, req);
    return ApiResponse.success(res, { message: 'Logged in', data });
  });

  verifyEmail = asyncHandler(async (req, res) => {
    const data = await this.auth.verifyEmail(req.body);
    return ApiResponse.success(res, { data });
  });

  changePassword = asyncHandler(async (req, res) => {
    const data = await this.auth.changePassword(this.#pid(req), req.body, req);
    return ApiResponse.success(res, { message: 'Password changed', data });
  });

  me = asyncHandler(async (req, res) => {
    const data = await this.auth.me(this.#pid(req));
    return ApiResponse.success(res, { data });
  });

  dashboard = asyncHandler(async (req, res) => {
    const data = await this.portal.dashboard(this.#pid(req));
    return ApiResponse.success(res, { data });
  });

  listDependents = asyncHandler(async (req, res) => {
    const data = await this.portal.listDependents(this.#pid(req));
    return ApiResponse.success(res, { data });
  });

  dependentDashboard = asyncHandler(async (req, res) => {
    const data = await this.portal.dependentDashboard(this.#pid(req), req.params.dependentId);
    return ApiResponse.success(res, { data });
  });

  dependentAppointments = asyncHandler(async (req, res) => {
    const data = await this.portal.dependentAppointments(
      this.#pid(req),
      req.params.dependentId,
      req.query
    );
    return ApiResponse.success(res, { data });
  });

  dependentInvoices = asyncHandler(async (req, res) => {
    const data = await this.portal.dependentInvoices(
      this.#pid(req),
      req.params.dependentId,
      req.query
    );
    return ApiResponse.success(res, { data });
  });

  dependentDocuments = asyncHandler(async (req, res) => {
    const data = await this.portal.dependentDocuments(this.#pid(req), req.params.dependentId);
    return ApiResponse.success(res, { data });
  });

  dependentTreatmentPlans = asyncHandler(async (req, res) => {
    const data = await this.portal.dependentTreatmentPlans(this.#pid(req), req.params.dependentId);
    return ApiResponse.success(res, { data });
  });

  bookDependentAppointment = asyncHandler(async (req, res) => {
    const data = await this.portal.bookDependentAppointment(
      this.#pid(req),
      req.params.dependentId,
      req.body,
      req
    );
    return ApiResponse.created(res, { message: 'Appointment booked', data });
  });

  dependentTimeline = asyncHandler(async (req, res) => {
    const data = await this.portal.dependentTimeline(this.#pid(req), req.params.dependentId, req.query);
    return ApiResponse.success(res, { data });
  });

  dependentPrescriptions = asyncHandler(async (req, res) => {
    const data = await this.portal.dependentPrescriptions(this.#pid(req), req.params.dependentId);
    return ApiResponse.success(res, { data });
  });

  getProfile = asyncHandler(async (req, res) => {
    const data = await this.portal.getProfile(this.#pid(req));
    return ApiResponse.success(res, { data });
  });

  updateProfile = asyncHandler(async (req, res) => {
    const data = await this.portal.updateProfile(this.#pid(req), req.body, req);
    return ApiResponse.success(res, { message: 'Profile updated', data });
  });

  listAppointments = asyncHandler(async (req, res) => {
    const data = await this.portal.listAppointments(this.#pid(req), req.query);
    return ApiResponse.success(res, { data });
  });

  getAppointment = asyncHandler(async (req, res) => {
    const data = await this.portal.getAppointment(this.#pid(req), req.params.id);
    return ApiResponse.success(res, { data });
  });

  bookAppointment = asyncHandler(async (req, res) => {
    const data = await this.portal.bookAppointment(this.#pid(req), req.body, req);
    return ApiResponse.created(res, { message: 'Appointment booked', data });
  });

  cancelAppointment = asyncHandler(async (req, res) => {
    const data = await this.portal.cancelAppointment(this.#pid(req), req.params.id, req.body, req);
    return ApiResponse.success(res, { message: 'Appointment cancelled', data });
  });

  rescheduleAppointment = asyncHandler(async (req, res) => {
    const data = await this.portal.rescheduleAppointment(
      this.#pid(req),
      req.params.id,
      req.body,
      req
    );
    return ApiResponse.success(res, { message: 'Appointment rescheduled', data });
  });

  appointmentCalendar = asyncHandler(async (req, res) => {
    const data = await this.portal.appointmentCalendar(this.#pid(req), req.query);
    return ApiResponse.success(res, { data });
  });

  availableSlots = asyncHandler(async (req, res) => {
    const data = await this.portal.availableSlots(
      req.query.doctorId,
      req.query.date,
      req.query.branchId
    );
    return ApiResponse.success(res, { data });
  });

  listConsultations = asyncHandler(async (req, res) => {
    const data = await this.portal.listConsultations(this.#pid(req));
    return ApiResponse.success(res, { data });
  });

  getConsultation = asyncHandler(async (req, res) => {
    const data = await this.portal.getConsultation(this.#pid(req), req.params.id);
    return ApiResponse.success(res, { data });
  });

  consultationDownload = asyncHandler(async (req, res) => {
    const data = await this.portal.consultationSummaryDownload(this.#pid(req), req.params.id);
    return ApiResponse.success(res, { data });
  });

  listPrescriptions = asyncHandler(async (req, res) => {
    const data = await this.portal.listPrescriptions(this.#pid(req));
    return ApiResponse.success(res, { data });
  });

  getPrescription = asyncHandler(async (req, res) => {
    const data = await this.portal.getPrescription(this.#pid(req), req.params.id);
    return ApiResponse.success(res, { data });
  });

  prescriptionPrint = asyncHandler(async (req, res) => {
    const data = await this.portal.prescriptionPrint(this.#pid(req), req.params.id, req);
    return ApiResponse.success(res, { data });
  });

  prescriptionRefill = asyncHandler(async (req, res) => {
    const data = await this.portal.prescriptionRefillPlaceholder();
    return ApiResponse.success(res, { data });
  });

  listTreatmentPlans = asyncHandler(async (req, res) => {
    const data = await this.portal.listTreatmentPlans(this.#pid(req));
    return ApiResponse.success(res, { data });
  });

  getTreatmentPlan = asyncHandler(async (req, res) => {
    const data = await this.portal.getTreatmentPlan(this.#pid(req), req.params.id);
    return ApiResponse.success(res, { data });
  });

  treatmentSummary = asyncHandler(async (req, res) => {
    const data = await this.portal.treatmentSummaryDownload(this.#pid(req), req.params.id);
    return ApiResponse.success(res, { data });
  });

  listTreatmentSessions = asyncHandler(async (req, res) => {
    const data = await this.portal.listTreatmentSessions(this.#pid(req), req.query);
    return ApiResponse.success(res, { data });
  });

  getTreatmentSession = asyncHandler(async (req, res) => {
    const data = await this.portal.getTreatmentSession(this.#pid(req), req.params.id);
    return ApiResponse.success(res, { data });
  });

  listInvoices = asyncHandler(async (req, res) => {
    const data = await this.portal.listInvoices(this.#pid(req), req.query);
    return ApiResponse.success(res, { data });
  });

  getInvoice = asyncHandler(async (req, res) => {
    const data = await this.portal.getInvoice(this.#pid(req), req.params.id);
    return ApiResponse.success(res, { data });
  });

  invoicePrint = asyncHandler(async (req, res) => {
    const data = await this.portal.invoicePrint(this.#pid(req), req.params.id, req);
    return ApiResponse.success(res, { data });
  });

  outstanding = asyncHandler(async (req, res) => {
    const data = await this.portal.outstandingBalance(this.#pid(req));
    return ApiResponse.success(res, { data });
  });

  paymentReceipt = asyncHandler(async (req, res) => {
    const data = await this.portal.paymentReceipt(this.#pid(req), req.params.paymentId, req);
    return ApiResponse.success(res, { data });
  });

  listDocuments = asyncHandler(async (req, res) => {
    const data = await this.portal.listDocuments(this.#pid(req));
    return ApiResponse.success(res, { data });
  });

  downloadDocument = asyncHandler(async (req, res) => {
    const data = await this.portal.downloadDocument(this.#pid(req), req.params.id, req);
    return ApiResponse.success(res, { data });
  });

  notifications = asyncHandler(async (req, res) => {
    const data = await this.portal.notificationsInbox(this.#pid(req), req.query);
    return ApiResponse.success(res, { data: data.items });
  });

  unreadCount = asyncHandler(async (req, res) => {
    const data = await this.portal.unreadNotificationCount(this.#pid(req));
    return ApiResponse.success(res, { data });
  });

  markNotificationRead = asyncHandler(async (req, res) => {
    const data = await this.portal.markNotificationRead(this.#pid(req), req.params.id);
    return ApiResponse.success(res, { data });
  });

  archiveNotification = asyncHandler(async (req, res) => {
    const data = await this.portal.archiveNotification(this.#pid(req), req.params.id);
    return ApiResponse.success(res, { data });
  });

  submitFeedback = asyncHandler(async (req, res) => {
    const data = await this.portal.submitFeedback(this.#pid(req), req.body, req);
    return ApiResponse.created(res, { message: 'Feedback submitted', data });
  });

  listFeedback = asyncHandler(async (req, res) => {
    const data = await this.portal.listFeedback(this.#pid(req));
    return ApiResponse.success(res, { data: data.items });
  });

  loyaltyBalance = asyncHandler(async (req, res) => {
    const data = await this.portal.loyaltyBalance(this.#pid(req));
    return ApiResponse.success(res, { data });
  });

  loyaltyLedger = asyncHandler(async (req, res) => {
    const data = await this.portal.loyaltyLedger(this.#pid(req), req.query);
    return ApiResponse.success(res, { data });
  });

  /** LOY-010 — "how to earn" list, generated from the currently-active earning rules. */
  loyaltyEarnRules = asyncHandler(async (req, res) => {
    const data = await this.portal.activeEarnRules();
    return ApiResponse.success(res, { data });
  });

  referral = asyncHandler(async (req, res) => {
    const data = await this.portal.referralSummary(this.#pid(req));
    return ApiResponse.success(res, { data });
  });

  dependentLoyaltyBalance = asyncHandler(async (req, res) => {
    const data = await this.portal.dependentLoyaltyBalance(this.#pid(req), req.params.dependentId);
    return ApiResponse.success(res, { data });
  });

  dependentLoyaltyLedger = asyncHandler(async (req, res) => {
    const data = await this.portal.dependentLoyaltyLedger(
      this.#pid(req),
      req.params.dependentId,
      req.query
    );
    return ApiResponse.success(res, { data });
  });

  timeline = asyncHandler(async (req, res) => {
    const data = await this.portal.timeline(this.#pid(req), req.query);
    return ApiResponse.success(res, { data });
  });

  submitPrivacyRequest = asyncHandler(async (req, res) => {
    const data = await this.portal.submitPrivacyRequest(this.#pid(req), req.body, req);
    return ApiResponse.created(res, { message: 'Privacy request submitted', data });
  });

  listPrivacyRequests = asyncHandler(async (req, res) => {
    const data = await this.portal.listPrivacyRequests(this.#pid(req));
    return ApiResponse.success(res, { data: data.items });
  });
}

export default PatientPortalController;
