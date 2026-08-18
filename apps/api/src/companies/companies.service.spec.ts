import { Test, TestingModule } from '@nestjs/testing';
import { CompaniesService } from './companies.service';
import { DB_POOL } from '../db/db.module';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let mockPool: { query: jest.Mock };

  beforeEach(async () => {
    mockPool = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        {
          provide: DB_POOL,
          useValue: mockPool,
        },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

