create table profiles (
  id uuid primary key references auth.users,
  full_name text,
  email text,
  phone text,
  plan text default 'free',
  sms_marketing boolean default false
);

create table bookings (
  id bigint generated always as identity primary key,
  owner_id uuid references profiles(id),
  pet_name text,
  address text,
  starts_at timestamptz
);

alter table bookings enable row level security;
create policy "Anyone can read bookings" on bookings for select using (true);
create policy "Owners add bookings" on bookings for insert with check (auth.uid() = owner_id);
