export const weeklyCapacitySchemaSql = `
  ALTER TABLE capacity_profile ADD COLUMN IF NOT EXISTS holidays_enabled boolean NOT NULL DEFAULT true;
  CREATE TABLE IF NOT EXISTS weekly_capacity_adjustment (
    week_start date PRIMARY KEY CHECK (EXTRACT(ISODOW FROM week_start)=1),
    availability numeric NOT NULL CHECK (availability BETWEEN 0 AND 1),
    label text NOT NULL DEFAULT '' CHECK (length(label)<=120)
  );
`;
