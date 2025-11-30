-- Change job-review-voice-notes bucket to private
update storage.buckets 
set public = false 
where id = 'job-review-voice-notes';