-- UNI_V3 / 0001 rollback — restores the original 0006 public read policies verbatim and removes the UNI_V3 ones.
-- STATUS: PROPOSED. Not applied anywhere. Not yet run against any database.

begin;

drop policy if exists "Verified students can read published active universities" on public.universities;
drop policy if exists "Verified students can read campuses of published active universities" on public.campuses;
drop policy if exists "Verified students can read university scholarships" on public.scholarships;

drop policy if exists "Public can read published active universities" on public.universities;
create policy "Public can read published active universities"
  on public.universities for select to anon, authenticated
  using (is_active = true and publication_status = 'published');

drop policy if exists "Public can read campuses of published active universities" on public.campuses;
create policy "Public can read campuses of published active universities"
  on public.campuses for select to anon, authenticated
  using (
    is_active = true
    and exists (select 1 from public.universities u where u.id = campuses.university_id and u.is_active = true and u.publication_status = 'published')
  );

drop policy if exists "Public can read published active courses of published unis" on public.courses;
create policy "Public can read published active courses of published unis"
  on public.courses for select to anon, authenticated
  using (
    is_active = true and publication_status = 'published'
    and exists (select 1 from public.universities u where u.id = courses.university_id and u.is_active = true and u.publication_status = 'published')
  );

drop policy if exists "Public can read intakes of published active courses" on public.course_intakes;
create policy "Public can read intakes of published active courses"
  on public.course_intakes for select to anon, authenticated
  using (
    exists (
      select 1 from public.courses c
      join public.universities u on u.id = c.university_id
      where c.id = course_intakes.course_id
        and c.is_active = true and c.publication_status = 'published'
        and u.is_active = true and u.publication_status = 'published'
    )
  );

drop policy if exists "Public can read tuition fees of published active courses" on public.course_tuition_fees;
create policy "Public can read tuition fees of published active courses"
  on public.course_tuition_fees for select to anon, authenticated
  using (
    exists (
      select 1 from public.courses c
      join public.universities u on u.id = c.university_id
      where c.id = course_tuition_fees.course_id
        and c.is_active = true and c.publication_status = 'published'
        and u.is_active = true and u.publication_status = 'published'
    )
  );

drop policy if exists "Public can read admission requirements of published courses" on public.course_admission_requirements;
create policy "Public can read admission requirements of published courses"
  on public.course_admission_requirements for select to anon, authenticated
  using (
    exists (
      select 1 from public.courses c
      join public.universities u on u.id = c.university_id
      where c.id = course_admission_requirements.course_id
        and c.is_active = true and c.publication_status = 'published'
        and u.is_active = true and u.publication_status = 'published'
    )
  );

drop policy if exists "Public can read active scholarships of published records" on public.scholarships;
create policy "Public can read active scholarships of published records"
  on public.scholarships for select to anon, authenticated
  using (
    is_active = true
    and (
      (scope = 'university' and exists (select 1 from public.universities u where u.id = scholarships.university_id and u.is_active = true and u.publication_status = 'published'))
      or (scope = 'course' and exists (
        select 1 from public.courses c join public.universities u on u.id = c.university_id
        where c.id = scholarships.course_id and c.is_active = true and c.publication_status = 'published' and u.is_active = true and u.publication_status = 'published'
      ))
    )
  );

drop function if exists public.has_university_directory_access();

commit;
