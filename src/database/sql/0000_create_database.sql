-- Run this ONCE, in pgAdmin, connected to any existing database (usually
-- "postgres") on the server inside your Rent_Manager group.
--
-- A pgAdmin "server group" is a folder in the pgAdmin tree, not a place on the
-- server — it organises connections. The database below is created on whichever
-- server you run this against, and appears under that server in the group.
--
-- Everything after this runs against rent_manager itself: connect to it, then
-- apply src/database/sql/0001_init.sql.

CREATE DATABASE rent_manager
  WITH ENCODING 'UTF8'
       TEMPLATE template0;

COMMENT ON DATABASE rent_manager IS 'RentFlow — property, tenancy and rent ledger';
