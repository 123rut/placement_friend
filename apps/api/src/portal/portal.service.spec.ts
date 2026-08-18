import { Test, TestingModule } from "@nestjs/testing";
import { PortalService } from "./portal.service";
import { DB_POOL } from "../db/db.module";
import { HttpException, HttpStatus } from "@nestjs/common";

describe("PortalService - Opportunity Status Tracking", () => {
  let service: PortalService;
  let mockPool: { query: jest.Mock };

  beforeEach(async () => {
    mockPool = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortalService,
        {
          provide: DB_POOL,
          useValue: mockPool,
        },
      ],
    }).compile();

    service = module.get<PortalService>(PortalService);
  });

  describe("getOpportunities", () => {
    it("should return opportunities with status NOT_VIEWED when no tracking row exists", async () => {
      // 1. Student query
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: "student-123", full_name: "Test Student" }],
      });
      // 2. Targets query
      mockPool.query.mockResolvedValueOnce({
        rows: [{ company_id: "comp-1" }],
      });
      // 3. Jobs query with LEFT JOIN
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: "job-1",
            company_id: "comp-1",
            role: "Software Engineer",
            role_type: "fulltime",
            apply_url: "https://example.com/apply/1",
            posted_at: new Date().toISOString(),
            location: "Bangalore",
            company_name: "Google",
            min_cgpa: "7.5",
            eligible_branches: "{CSE,ECE}",
            status: "NOT_VIEWED",
            viewed_at: null,
            applied_at: null,
          },
        ],
      });

      const result = await service.getOpportunities("student-123");
      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe("NOT_VIEWED");
      expect(result.data[0].viewed_at).toBeNull();
      expect(result.data[0].applied_at).toBeNull();
    });

    it("should return opportunities with resolved status VIEWED or APPLIED", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: "student-123", full_name: "Test Student" }],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ company_id: "comp-1" }],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: "job-1",
            company_id: "comp-1",
            role: "Software Engineer",
            role_type: "fulltime",
            apply_url: "https://example.com/apply/1",
            posted_at: new Date().toISOString(),
            location: "Bangalore",
            company_name: "Google",
            min_cgpa: "7.5",
            eligible_branches: "{CSE}",
            status: "APPLIED",
            viewed_at: new Date("2026-08-01").toISOString(),
            applied_at: new Date("2026-08-02").toISOString(),
          },
        ],
      });

      const result = await service.getOpportunities("student-123");
      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe("APPLIED");
      expect(result.data[0].viewed_at).toBeDefined();
      expect(result.data[0].applied_at).toBeDefined();
    });
  });

  describe("markOpportunityViewed", () => {
    it("should throw 404 if student profile does not exist", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.markOpportunityViewed("job-1", "non-existent-student")
      ).rejects.toThrow(new HttpException("Student profile not found", HttpStatus.NOT_FOUND));
    });

    it("should throw 404 if job does not exist", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: "student-123" }] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.markOpportunityViewed("non-existent-job", "student-123")
      ).rejects.toThrow(new HttpException("Opportunity not found", HttpStatus.NOT_FOUND));
    });

    it("should successfully record viewed status", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: "student-123" }] });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: "job-1" }] });
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: "track-1",
            student_id: "student-123",
            job_id: "job-1",
            status: "VIEWED",
            viewed_at: new Date().toISOString(),
            applied_at: null,
          },
        ],
      });

      const result = await service.markOpportunityViewed("job-1", "student-123");
      expect(result.success).toBe(true);
      expect(result.data.status).toBe("VIEWED");
      expect(result.data.job_id).toBe("job-1");
      expect(result.data.student_id).toBe("student-123");
    });
  });

  describe("markOpportunityApplied", () => {
    it("should successfully record applied status", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: "student-123" }] });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: "job-1" }] });
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: "track-1",
            student_id: "student-123",
            job_id: "job-1",
            status: "APPLIED",
            viewed_at: new Date().toISOString(),
            applied_at: new Date().toISOString(),
          },
        ],
      });

      const result = await service.markOpportunityApplied("job-1", "student-123");
      expect(result.success).toBe(true);
      expect(result.data.status).toBe("APPLIED");
      expect(result.data.applied_at).toBeDefined();
    });
  });
});
