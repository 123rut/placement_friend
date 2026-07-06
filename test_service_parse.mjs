import pg from 'pg';
import dotenv from 'dotenv';
import { ResumeService } from './apps/api/src/resume/resume.service.ts'; // wait! it's typescript!

// Let's run it with ts-node or dynamically.
// Or we can just write a plain javascript version of the service methods inside our test script to avoid typescript compilation issues in the script!
