-- Staff Access Reviews (Governance sidebar item, reusing Compliance &
-- Security's access_reviews table/page — see the Policies precedent) needs
-- an explicit "Review date" distinct from "Next review" (next_review_date
-- already existed; the date the review itself was performed did not,
-- previously implied only by created_at).

alter table access_reviews add column if not exists review_date date;
update access_reviews set review_date = created_at::date where review_date is null;
alter table access_reviews alter column review_date set default current_date;
alter table access_reviews alter column review_date set not null;
