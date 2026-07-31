insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'duel-recordings',
  'duel-recordings',
  false,
  26214400,
  array[
    'audio/flac', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav',
    'audio/x-m4a', 'audio/x-wav', 'audio/webm', 'application/ogg',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
