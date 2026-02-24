-- Move SKRILLEX from BB2 series to OTHER
UPDATE programs SET series = 'OTHER' WHERE program_name = 'SKRILLEX' AND series = 'BB2';
