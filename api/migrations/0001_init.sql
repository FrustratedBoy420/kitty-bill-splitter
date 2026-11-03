-- Schema for the shared bill splitter.
-- All money is stored as INTEGER cents. Every constraint is named so errors and docs can refer to it.

CREATE TABLE homes (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  CONSTRAINT uq_homes_id UNIQUE (id),
  CONSTRAINT chk_homes_name_not_blank CHECK (length(trim(name)) > 0)
);

-- seq is the order members were added. AUTOINCREMENT never reuses a value, so the order is
-- total and stable (timestamps can tie inside the same millisecond).
CREATE TABLE members (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL,
  home_id TEXT NOT NULL,
  name TEXT NOT NULL,
  CONSTRAINT uq_members_id UNIQUE (id),
  -- Target for the composite foreign key on shares.
  CONSTRAINT uq_members_home_id UNIQUE (home_id, id),
  CONSTRAINT fk_members_home FOREIGN KEY (home_id) REFERENCES homes (id),
  CONSTRAINT chk_members_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE TABLE bills (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL,
  home_id TEXT NOT NULL,
  title TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  CONSTRAINT uq_bills_id UNIQUE (id),
  CONSTRAINT uq_bills_home_id UNIQUE (home_id, id),
  CONSTRAINT fk_bills_home FOREIGN KEY (home_id) REFERENCES homes (id),
  CONSTRAINT chk_bills_title_not_blank CHECK (length(trim(title)) > 0),
  CONSTRAINT chk_bills_total_positive CHECK (typeof(total_cents) = 'integer' AND total_cents > 0)
);

-- home_id is repeated on shares so the two composite foreign keys force the bill and the member
-- of a share to belong to the same home.
CREATE TABLE shares (
  id TEXT PRIMARY KEY NOT NULL,
  home_id TEXT NOT NULL,
  bill_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  paid_at TEXT,
  paid_key TEXT,
  CONSTRAINT fk_shares_bill FOREIGN KEY (home_id, bill_id) REFERENCES bills (home_id, id),
  CONSTRAINT fk_shares_member FOREIGN KEY (home_id, member_id) REFERENCES members (home_id, id),
  CONSTRAINT uq_shares_bill_member UNIQUE (bill_id, member_id),
  -- 0 is allowed: 2 cents split over 3 members gives 1, 1, 0.
  CONSTRAINT chk_shares_amount_non_negative CHECK (
    typeof(amount_cents) = 'integer' AND amount_cents >= 0
  ),
  CONSTRAINT chk_shares_paid_consistent CHECK ((paid_at IS NULL) = (paid_key IS NULL))
);

CREATE INDEX idx_members_home ON members (home_id, seq);
CREATE INDEX idx_bills_home ON bills (home_id, seq);
CREATE INDEX idx_shares_member_unpaid ON shares (member_id) WHERE paid_at IS NULL;
