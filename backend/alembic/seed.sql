-- ============================================================
-- Brandora AI — Initial Seed Data
-- This file is auto-executed by Docker postgres on first init
-- ============================================================

-- ── Subscription Plans ────────────────────────────────────────
INSERT INTO subscription_plans (id, name, tier, price_monthly_usd, ai_generations_limit, max_users, max_brands, features)
VALUES
  (
    gen_random_uuid(),
    'Starter',
    'free',
    0,
    20,
    1,
    1,
    '["linkedin", "instagram", "twitter", "basic_templates"]'
  ),
  (
    gen_random_uuid(),
    'Pro',
    'pro',
    29,
    150,
    2,
    1,
    '["all_platforms", "scheduling", "calendar", "basic_analytics", "5_templates"]'
  ),
  (
    gen_random_uuid(),
    'Growth',
    'growth',
    79,
    500,
    5,
    3,
    '["all_platforms", "scheduling", "calendar", "advanced_analytics", "campaign_management", "multi_language", "brand_voice", "csr_stories", "20_templates"]'
  ),
  (
    gen_random_uuid(),
    'Enterprise',
    'enterprise',
    299,
    -1,
    -1,
    -1,
    '["all_features", "white_label", "api_access", "custom_templates", "dedicated_support"]'
  )
ON CONFLICT DO NOTHING;


-- ── Festival / Awareness Day Calendar ────────────────────────
INSERT INTO festival_calendar (
  id,
  name,
  date_month,
  date_day,
  description,
  category,
  sdg_tags,
  default_hashtags,
  is_global,
  is_india_specific
)
VALUES
  (
    gen_random_uuid(),
    'World Menstrual Hygiene Day',
    5,
    28,
    'Global day to raise awareness about good menstrual hygiene management',
    'menstrual_health',
    '[3, 5, 6]',
    '["#MenstrualHygieneDay", "#MHDay", "#PeriodPositive", "#MenstrualHealth", "#BreakTheTaboo"]',
    true,
    false
  ),
  (
    gen_random_uuid(),
    'World Toilet Day',
    11,
    19,
    'Inspiring action to tackle the global sanitation crisis',
    'sanitation',
    '[6, 3, 11]',
    '["#WorldToiletDay", "#Sanitation4All", "#WASH", "#ToiletDay", "#CleanSanitation"]',
    true,
    false
  ),
  (
    gen_random_uuid(),
    'World Water Day',
    3,
    22,
    'Advocating for the sustainable management of freshwater resources',
    'water_sanitation',
    '[6]',
    '["#WorldWaterDay", "#Water4All", "#WaterSecurity", "#CleanWater", "#WASH"]',
    true,
    false
  ),
  (
    gen_random_uuid(),
    'Global Handwashing Day',
    10,
    15,
    'Dedicated to increasing awareness of handwashing with soap',
    'hygiene',
    '[3, 6]',
    '["#GlobalHandwashingDay", "#HandwashingDay", "#CleanHands", "#HygieneMatters", "#WashYourHands"]',
    true,
    false
  ),
  (
    gen_random_uuid(),
    'International Women''s Day',
    3,
    8,
    'Celebrating women''s achievements and advocating for gender equality',
    'gender_equality',
    '[5, 3, 6]',
    '["#IWD2026", "#InternationalWomensDay", "#GenderEquality", "#EachForEqual", "#WomensRights"]',
    true,
    false
  ),
  (
    gen_random_uuid(),
    'World Environment Day',
    6,
    5,
    'Principal vehicle for encouraging awareness and action for the protection of the environment',
    'environment',
    '[13, 6, 12]',
    '["#WorldEnvironmentDay", "#ForNature", "#GenerationRestoration", "#EcoFriendly", "#Sustainability"]',
    true,
    false
  ),
  (
    gen_random_uuid(),
    'World Health Day',
    4,
    7,
    'Draw attention to important health issues affecting people of all ages',
    'health',
    '[3]',
    '["#WorldHealthDay", "#HealthForAll", "#GlobalHealth", "#WHO", "#HealthMatters"]',
    true,
    false
  ),
  (
    gen_random_uuid(),
    'Gandhi Jayanti / Swachh Bharat',
    10,
    2,
    'Birthday of Mahatma Gandhi and Swachh Bharat Mission anniversary',
    'sanitation',
    '[6, 11]',
    '["#SwachhBharat", "#GandhiJayanti", "#CleanIndia", "#SwachhBharatMission", "#GandhiAt157"]',
    false,
    true
  ),
  (
    gen_random_uuid(),
    'Swachh Bharat Diwas',
    9,
    19,
    'Swachh Bharat Mission launch anniversary',
    'sanitation',
    '[6]',
    '["#SwachhBharatDiwas", "#SwachhBharat", "#CleanIndia", "#ODF", "#SanitationForAll"]',
    false,
    true
  ),
  (
    gen_random_uuid(),
    'Zero Discrimination Day',
    3,
    1,
    'Promoting equality before the law and in practice',
    'inclusion',
    '[5, 10]',
    '["#ZeroDiscriminationDay", "#ZeroDiscrimination", "#WeAreAll", "#Inclusion"]',
    true,
    false
  ),
  (
    gen_random_uuid(),
    'World Pollution Prevention Day',
    12,
    2,
    'Raising awareness about pollution and its impact on health',
    'environment',
    '[3, 6, 13]',
    '["#WorldPollutionPreventionDay", "#PollutionPrevention", "#CleanEarth", "#SustainableLiving"]',
    true,
    false
  ),
  (
    gen_random_uuid(),
    'World Population Day',
    7,
    11,
    'Focus attention on the urgency and importance of population issues',
    'health',
    '[3, 5, 6]',
    '["#WorldPopulationDay", "#PopulationDay", "#UNFPA", "#HealthForAll"]',
    true,
    false
  ),
  (
    gen_random_uuid(),
    'International Day of Rural Women',
    10,
    15,
    'Recognizing the critical role women play in enhancing rural development',
    'gender_equality',
    '[5, 6, 2]',
    '["#RuralWomen", "#RuralWomensDay", "#WomenInAgriculture", "#EmpowerWomen"]',
    true,
    false
  ),
  (
    gen_random_uuid(),
    'World Breastfeeding Week (Start)',
    8,
    1,
    'Promoting breastfeeding and improving the health of babies around the world',
    'health',
    '[3, 5]',
    '["#WorldBreastfeedingWeek", "#WBW2026", "#BreastfeedingSupport", "#NursingMoms"]',
    true,
    false
  ),
  (
    gen_random_uuid(),
    'World Humanitarian Day',
    8,
    19,
    'Honour humanitarian workers and advocate for humanitarian action',
    'inclusion',
    '[3, 6, 17]',
    '["#WorldHumanitarianDay", "#HumanitarianHeroes", "#ForHumanity", "#RealLifeHeroes"]',
    true,
    false
  )
ON CONFLICT DO NOTHING;


-- ── Default Content Templates ──────────────────────────────────
INSERT INTO content_templates (
  id,
  name,
  description,
  platform,
  category,
  template_content,
  variables,
  is_system
)
VALUES
  (
    gen_random_uuid(),
    'MHD Impact Post',
    'World Menstrual Hygiene Day awareness LinkedIn post',
    'linkedin',
    'awareness',
    E'On #WorldMenstrualHygieneDay, we reflect on our journey to ensure every girl and woman has access to safe, dignified menstrual health management.\n\n{{impact_stat}} girls/women reached. {{locations}} communities transformed.\n\nBut numbers only tell part of the story. The real change is in {{qualitative_outcome}}.\n\n{{call_to_action}}\n\n#MHDay #MenstrualHealth #SocialImpact #SDG5 #SDG6',
    '["impact_stat", "locations", "qualitative_outcome", "call_to_action"]',
    true
  ),
  (
    gen_random_uuid(),
    'CSR Impact Report Post',
    'Quarterly CSR impact update for LinkedIn',
    'linkedin',
    'csr',
    E'Q{{quarter}} {{year}} Impact Update\n\nWe''re proud to share the progress of our {{program_name}} initiative:\n\n✅ {{metric_1}}\n✅ {{metric_2}}\n✅ {{metric_3}}\n\nThis work aligns with SDG {{sdg_number}}: {{sdg_name}}\n\nThank you to our partners and the communities we serve for making this possible.\n\n#CSR #SocialImpact #Sustainability #{{company_hashtag}}',
    '["quarter", "year", "program_name", "metric_1", "metric_2", "metric_3", "sdg_number", "sdg_name", "company_hashtag"]',
    true
  ),
  (
    gen_random_uuid(),
    'World Toilet Day Community Story',
    'Instagram post for World Toilet Day with community story',
    'instagram',
    'awareness',
    E'#WorldToiletDay\n\nEvery person deserves a safe, clean toilet. Yet 3.5 billion people still lack safely managed sanitation.\n\n{{community_story}}\n\nThat''s why we''ve built {{facilities_count}} toilets in {{location}}, reaching {{beneficiaries}} people.\n\nSanitation is a human right. 💙\n\n#Sanitation4All #WASH #SDG6 #CleanSanitation #ToiletDay',
    '["community_story", "facilities_count", "location", "beneficiaries"]',
    true
  ),
  (
    gen_random_uuid(),
    'IWD Gender & WASH Post',
    'International Women''s Day post connecting gender equality and WASH access',
    'linkedin',
    'awareness',
    E'On #InternationalWomensDay, let''s talk about a connection that''s often overlooked:\n\nWhen women and girls lack access to safe sanitation and menstrual hygiene facilities, their safety, dignity, and economic participation are all at risk.\n\n{{data_point}}\n\nOur work in {{geography}} is changing this — {{program_description}}\n\nGender equality starts with the basics. #IWD2026 #GenderEquality #WASH #SDG5 #SDG6',
    '["data_point", "geography", "program_description"]',
    true
  ),
  (
    gen_random_uuid(),
    'Swachh Bharat Anniversary Post',
    'Gandhi Jayanti / Swachh Bharat Mission anniversary post (India-specific)',
    'linkedin',
    'csr',
    E'Today, on Gandhi Jayanti, we celebrate the spirit of Swachh Bharat — a cleaner, healthier India.\n\nSince joining the #SwachhBharat mission, {{organization_name}} has:\n🚽 Built {{toilet_count}} community and household toilets\n👩‍👧 Trained {{trained_count}} women as WASH champions\n🏫 Covered {{school_count}} schools with menstrual hygiene education\n\n{{personal_message}}\n\nJai Hind. #GandhiJayanti #CleanIndia #SwachhBharatMission #ODF #SanitationForAll',
    '["organization_name", "toilet_count", "trained_count", "school_count", "personal_message"]',
    true
  )
ON CONFLICT DO NOTHING;
