import { Controller, Get, Post, Patch, Delete, Body, Query, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import { CompaniesService } from "./companies.service";

@Controller("companies")
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  async getCompanies(
    @Query("page") page = "1",
    @Query("limit") limit = "50",
    @Query("search") search = "",
    @Query("status") status = "",
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    return this.companiesService.getCompanies(pageNum, limitNum, search, status);
  }

  @Post()
  async createCompany(@Body() body: any, @Res() res: Response) {
    const result = await this.companiesService.createCompany(body);
    return res.status(result.status).json(result.data);
  }

  @Patch(":id")
  async updateCompany(@Param("id") id: string, @Body() body: any, @Res() res: Response) {
    const result = await this.companiesService.updateCompany(id, body);
    return res.status(result.status).json(result.data);
  }

  @Delete(":id")
  async deleteCompany(@Param("id") id: string, @Res() res: Response) {
    const result = await this.companiesService.deleteCompany(id);
    return res.status(result.status).json(result.data);
  }
}
