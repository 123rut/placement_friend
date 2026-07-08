import { Controller, Get, Post, Patch, Param, Query, Body } from "@nestjs/common";
import { PortalService } from "./portal.service";

@Controller()
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  // 1. Opportunities
  @Get("opportunities")
  async getOpportunities(@Query("studentId") studentId: string) {
    return this.portalService.getOpportunities(studentId);
  }

  // 2. Notifications
  @Get("notifications")
  async getNotifications(
    @Query("studentId") studentId: string,
    @Query("unread_only") unreadOnly?: string
  ) {
    const unread = unreadOnly === "true";
    return this.portalService.getNotifications(studentId, unread);
  }

  @Patch("notifications/read-all")
  async markAllNotificationsRead(@Query("studentId") studentId: string, @Body("studentId") bodyStudentId?: string) {
    const sId = studentId || bodyStudentId;
    return this.portalService.markAllNotificationsRead(sId!);
  }

  @Patch("notifications/:id")
  async updateNotification(
    @Param("id") alertId: string,
    @Query("studentId") studentId: string,
    @Body("read") read?: boolean
  ) {
    const readVal = read !== undefined ? read : true;
    return this.portalService.updateNotification(alertId, studentId, readVal);
  }

  // 3. Student Preferences
  @Patch("students/preferences")
  async updatePreferences(
    @Body("studentId") studentId: string,
    @Body("company_id") companyId: string,
    @Body("notify_email") notifyEmail?: boolean,
    @Body("notify_dashboard") notifyDashboard?: boolean
  ) {
    return this.portalService.updatePreferences(studentId, companyId, notifyEmail, notifyDashboard);
  }

  // 4. System State
  @Post("system-state")
  async setSystemState(@Body("studentId") studentId: string) {
    return this.portalService.setSystemState(studentId);
  }

  @Get("system-state")
  async getSystemState() {
    return this.portalService.getSystemState();
  }
}
