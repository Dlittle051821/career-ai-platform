-- M17 security follow-up:
-- Supabase grants EXECUTE on newly created functions to anon/authenticated
-- through its default privilege configuration.
-- M17 document RPCs must be callable only by authenticated users.

revoke execute on function public.get_my_application_documents(uuid) from public;
revoke execute on function public.get_my_application_documents(uuid) from anon;
grant execute on function public.get_my_application_documents(uuid) to authenticated;

revoke execute on function public.student_upload_application_document(uuid, text, text, text, text, bigint, text) from public;
revoke execute on function public.student_upload_application_document(uuid, text, text, text, text, bigint, text) from anon;
grant execute on function public.student_upload_application_document(uuid, text, text, text, text, bigint, text) to authenticated;

revoke execute on function public.student_remove_application_document(uuid) from public;
revoke execute on function public.student_remove_application_document(uuid) from anon;
grant execute on function public.student_remove_application_document(uuid) to authenticated;
