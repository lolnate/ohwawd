export const assignmentSchemaSql = `
  ALTER TABLE workspace ADD COLUMN IF NOT EXISTS assignment_v1_migrated boolean NOT NULL DEFAULT false;
  ALTER TABLE linear_project_cache ADD COLUMN IF NOT EXISTS priority integer CHECK (priority BETWEEN 0 AND 4);
  ALTER TABLE work_package ADD COLUMN IF NOT EXISTS sequence_position integer;
  ALTER TABLE capacity_profile ADD COLUMN IF NOT EXISTS scoping_lead_days integer NOT NULL DEFAULT 14 CHECK (scoping_lead_days BETWEEN 0 AND 365);
  CREATE TABLE IF NOT EXISTS package_extra_scope (
    package_id text PRIMARY KEY REFERENCES work_package(id),
    points numeric(12,3) NOT NULL CHECK (points > 0),
    notes text NOT NULL DEFAULT '',
    issue_ids text[] NOT NULL DEFAULT '{}',
    issue_baseline jsonb NOT NULL DEFAULT '[]',
    legacy_review text
  );
`;

// Runs once in the versioned migration, never on reads or source refreshes.
export const assignmentMigrationSql = assignmentSchemaSql + `
  DO $$
  DECLARE lane record; candidate text; next_position integer; remaining_ids text[];
  BEGIN
    IF EXISTS(SELECT 1 FROM workspace WHERE id=1 AND NOT assignment_v1_migrated) THEN
      INSERT INTO package_extra_scope(package_id,points,notes,issue_ids,issue_baseline,legacy_review)
      SELECT package_id,points,notes,issue_ids,issue_baseline,legacy_review FROM (SELECT w.id AS package_id,
        COALESCE((SELECT GREATEST(0,a.points-COALESCE((SELECT SUM(i.estimate) FROM linear_issue_cache i
          WHERE i.project_id=w.project_id AND i.linear_id=ANY(a.issue_ids)),0))
          FROM package_allowance a WHERE a.package_id=w.id AND a.kind='unestimated'),0)
        + COALESCE((SELECT a.points FROM package_allowance a WHERE a.package_id=w.id AND a.kind='discovery'),0) AS points,
        COALESCE((SELECT string_agg(a.kind || ': ' || a.rationale,E'\n' ORDER BY a.kind)
          FROM package_allowance a WHERE a.package_id=w.id AND a.rationale<>''),'') AS notes,
        COALESCE((SELECT a.issue_ids FROM package_allowance a WHERE a.package_id=w.id AND a.kind='unestimated'),'{}') AS issue_ids,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.linear_id,'estimate',i.estimate,'open',i.state_type NOT IN ('completed','canceled')) ORDER BY i.linear_id)
          FROM linear_issue_cache i WHERE i.project_id=w.project_id),'[]') AS issue_baseline,
        CASE WHEN EXISTS(SELECT 1 FROM package_allowance a WHERE a.package_id=w.id AND
          ((a.kind='discovery' AND EXISTS(SELECT 1 FROM linear_issue_cache i WHERE i.project_id=w.project_id
            AND i.state_type NOT IN ('completed','canceled') AND NOT(i.linear_id=ANY(a.issue_ids))))
          OR (a.kind='unestimated' AND EXISTS(SELECT 1 FROM unnest(a.issue_ids) claimed(id)
            LEFT JOIN linear_issue_cache i ON i.linear_id=claimed.id AND i.project_id=w.project_id
            WHERE i.linear_id IS NULL OR (i.state_type IN ('completed','canceled') AND i.estimate IS NULL)))))
          THEN 'Review scope carried forward from legacy allowances.' ELSE NULL END AS legacy_review
      FROM work_package w WHERE EXISTS(SELECT 1 FROM package_allowance a WHERE a.package_id=w.id)) converted WHERE points>0
      ON CONFLICT(package_id) DO NOTHING;
      FOR lane IN SELECT DISTINCT stream_id FROM work_package WHERE selected AND stream_id IS NOT NULL LOOP
        SELECT array_agg(id ORDER BY priority_rank,id) INTO remaining_ids FROM work_package WHERE selected AND stream_id=lane.stream_id;
        next_position := 1;
        WHILE cardinality(remaining_ids)>0 LOOP
          WITH RECURSIVE reach(predecessor_id,successor_id) AS (
            SELECT predecessor_id,successor_id FROM package_dependency WHERE NOT waived
            UNION
            SELECT r.predecessor_id,d.successor_id FROM reach r JOIN package_dependency d ON d.predecessor_id=r.successor_id WHERE NOT d.waived
          )
          SELECT w.id INTO candidate FROM work_package w WHERE w.id=ANY(remaining_ids) AND NOT EXISTS(
            SELECT 1 FROM reach r JOIN work_package prior ON prior.id=r.predecessor_id
            JOIN linear_project_cache p ON p.linear_id=prior.project_id
            WHERE r.successor_id=w.id AND prior.id=ANY(remaining_ids) AND prior.id<>w.id
              AND NOT(p.status ILIKE '%completed%' AND NOT EXISTS(SELECT 1 FROM linear_issue_cache i WHERE i.project_id=p.linear_id AND i.state_type NOT IN ('completed','canceled'))
                AND NOT EXISTS(SELECT 1 FROM package_extra_scope e WHERE e.package_id=prior.id)))
          ORDER BY w.priority_rank,w.id LIMIT 1;
          IF candidate IS NULL THEN candidate := remaining_ids[1]; END IF;
          UPDATE work_package SET sequence_position=next_position WHERE id=candidate;
          remaining_ids := array_remove(remaining_ids,candidate);
          next_position := next_position+1;
        END LOOP;
      END LOOP;
      UPDATE workspace SET assignment_v1_migrated=true WHERE id=1;
    END IF;
  END $$;
`;
