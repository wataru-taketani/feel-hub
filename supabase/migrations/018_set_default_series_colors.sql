-- Set default series colors for programs that still have the placeholder gray (#6B7280)
-- These will be overwritten by the scraper when it fetches individual program colors

UPDATE programs SET color_code = '#FFFF66', text_color = '#000000'
  WHERE series = 'BB1' AND color_code = '#6B7280';

UPDATE programs SET color_code = '#FF9933', text_color = '#000000'
  WHERE series = 'BB2' AND color_code = '#6B7280';

UPDATE programs SET color_code = '#FF3300', text_color = '#000000'
  WHERE series = 'BB3' AND color_code = '#6B7280';

UPDATE programs SET color_code = '#CC66FF', text_color = '#FFFFFF'
  WHERE series = 'BSW' AND color_code = '#6B7280';

UPDATE programs SET color_code = '#990099', text_color = '#FFFF66'
  WHERE series = 'BSWi' AND color_code = '#6B7280';

UPDATE programs SET color_code = '#0000CC', text_color = '#FFFFFF'
  WHERE series = 'BSL' AND color_code = '#6B7280';

UPDATE programs SET color_code = '#00CCFF', text_color = '#000000'
  WHERE series = 'BSB' AND color_code = '#6B7280';

UPDATE programs SET color_code = '#336699', text_color = '#FFFF66'
  WHERE series = 'BSBi' AND color_code = '#6B7280';
