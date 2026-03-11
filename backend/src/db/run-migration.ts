import { readFileSync } from 'fs';
import { join } from 'path';
import pool from './index.js';

async function runMigration() {
  try {
    console.log('Running database migration...');
    
    const migrationPath = join(process.cwd(), 'src', 'db', 'migrations', '001_initial_schema.sql');
    const sql = readFileSync(migrationPath, 'utf-8');
    
    await pool.query(sql);
    
    console.log('✓ Migration completed successfully!');
    console.log('✓ All tables created:');
    console.log('  - users');
    console.log('  - pain_sessions');
    console.log('  - pain_markers');
    console.log('  - symptom_descriptors');
    console.log('  - follow_up_responses');
    console.log('  - symptom_signals');
    console.log('  - body_maps');
    console.log('  - insight_reports');
    console.log('  - audit_logs');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
