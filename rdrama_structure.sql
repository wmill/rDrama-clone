--
-- PostgreSQL database dump
--

\restrict 6ZebfpNU6dVHNda7u3FqFKtEn8bQ4z3RORGlCAZXJwq6HP8TvklD8Wcir0DMH5V

-- Dumped from database version 17.6 (Debian 17.6-2.pgdg13+1)
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: fuzzystrmatch; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA public;


--
-- Name: EXTENSION fuzzystrmatch; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION fuzzystrmatch IS 'determine similarities and distance between strings';


--
-- Name: ltree; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS ltree WITH SCHEMA public;


--
-- Name: EXTENSION ltree; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION ltree IS 'data type for hierarchical tree-like structures';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: filterbehavior; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.filterbehavior AS ENUM (
    'AUTOMATIC',
    'UNFILTERED',
    'FILTERED'
);


ALTER TYPE public.filterbehavior OWNER TO postgres;

--
-- Name: statemod; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.statemod AS ENUM (
    'VISIBLE',
    'FILTERED',
    'REMOVED'
);


ALTER TYPE public.statemod OWNER TO postgres;

--
-- Name: statereport; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.statereport AS ENUM (
    'UNREPORTED',
    'RESOLVED',
    'REPORTED',
    'IGNORED'
);


ALTER TYPE public.statereport OWNER TO postgres;

--
-- Name: usertag; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.usertag AS ENUM (
    'Quality',
    'Good',
    'Comment',
    'Warning',
    'Tempban',
    'Permban',
    'Spam',
    'Bot'
);


ALTER TYPE public.usertag OWNER TO postgres;

--
-- Name: volunteerjanitorresult; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.volunteerjanitorresult AS ENUM (
    'Pending',
    'TopQuality',
    'Good',
    'Neutral',
    'Bad',
    'Warning',
    'Ban'
);


ALTER TYPE public.volunteerjanitorresult OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: submissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.submissions (
    id integer NOT NULL,
    author_id integer NOT NULL,
    created_utc integer NOT NULL,
    over_18 boolean DEFAULT false NOT NULL,
    distinguish_level integer DEFAULT 0 NOT NULL,
    edited_utc integer DEFAULT 0 NOT NULL,
    is_pinned boolean DEFAULT false NOT NULL,
    upvotes integer DEFAULT 1 NOT NULL,
    downvotes integer DEFAULT 0 NOT NULL,
    app_id integer,
    thumburl character varying(200),
    private boolean DEFAULT false NOT NULL,
    views integer DEFAULT 0 NOT NULL,
    is_bot boolean DEFAULT false NOT NULL,
    bannedfor boolean,
    comment_count integer DEFAULT 0 NOT NULL,
    stickied character varying(40),
    title character varying(500) NOT NULL,
    url character varying(2083),
    body text,
    body_html text,
    embed_url character varying(1500),
    title_html character varying(1500) NOT NULL,
    realupvotes integer,
    flair character varying(350),
    stickied_utc integer,
    ghost boolean DEFAULT false NOT NULL,
    bump_utc integer,
    task_id integer,
    state_user_deleted_utc timestamp with time zone,
    state_mod public.statemod NOT NULL,
    state_mod_set_by character varying,
    state_report public.statereport NOT NULL
);


ALTER TABLE public.submissions OWNER TO postgres;

--
-- Name: bump_utc(public.submissions); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bump_utc(public.submissions) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$
      SELECT CREATED_UTC
      FROM comments
      WHERE parent_submission = $1.id
      ORDER BY created_utc desc
      LIMIT 1
      $_$;


ALTER FUNCTION public.bump_utc(public.submissions) OWNER TO postgres;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO postgres;

--
-- Name: alts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alts (
    user1 integer NOT NULL,
    user2 integer NOT NULL,
    is_manual boolean DEFAULT false NOT NULL,
    CONSTRAINT alts_cant_be_equal CHECK ((user1 <> user2))
);


ALTER TABLE public.alts OWNER TO postgres;

--
-- Name: award_relationships; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.award_relationships (
    id integer NOT NULL,
    user_id integer NOT NULL,
    submission_id integer,
    comment_id integer,
    kind character varying(20) NOT NULL
);


ALTER TABLE public.award_relationships OWNER TO postgres;

--
-- Name: award_relationships_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.award_relationships_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.award_relationships_id_seq OWNER TO postgres;

--
-- Name: award_relationships_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.award_relationships_id_seq OWNED BY public.award_relationships.id;


--
-- Name: badge_defs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.badge_defs (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    description character varying(200)
);


ALTER TABLE public.badge_defs OWNER TO postgres;

--
-- Name: badge_defs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.badge_defs_id_seq
    AS integer
    START WITH 106
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.badge_defs_id_seq OWNER TO postgres;

--
-- Name: badge_defs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.badge_defs_id_seq OWNED BY public.badge_defs.id;


--
-- Name: badges; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.badges (
    badge_id integer NOT NULL,
    user_id integer NOT NULL,
    description character varying(256),
    url character varying(256)
);


ALTER TABLE public.badges OWNER TO postgres;

--
-- Name: banneddomains; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.banneddomains (
    domain character varying(100) NOT NULL,
    reason character varying(100) NOT NULL
);


ALTER TABLE public.banneddomains OWNER TO postgres;

--
-- Name: chat_message; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_message (
    id integer NOT NULL,
    author_id integer NOT NULL,
    quote_id integer,
    text character varying NOT NULL,
    text_html character varying NOT NULL,
    created_datetimez timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.chat_message OWNER TO postgres;

--
-- Name: chat_message_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_message_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_message_id_seq OWNER TO postgres;

--
-- Name: chat_message_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_message_id_seq OWNED BY public.chat_message.id;


--
-- Name: client_auths; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_auths (
    user_id integer NOT NULL,
    oauth_client integer NOT NULL,
    access_token character varying(128) NOT NULL
);


ALTER TABLE public.client_auths OWNER TO postgres;

--
-- Name: comment_save_relationship; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comment_save_relationship (
    user_id integer NOT NULL,
    comment_id integer NOT NULL
);


ALTER TABLE public.comment_save_relationship OWNER TO postgres;

--
-- Name: commentflags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.commentflags (
    user_id integer NOT NULL,
    comment_id integer NOT NULL,
    reason character varying(350),
    id integer NOT NULL,
    created_datetimez timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.commentflags OWNER TO postgres;

--
-- Name: commentflags_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.commentflags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.commentflags_id_seq OWNER TO postgres;

--
-- Name: commentflags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.commentflags_id_seq OWNED BY public.commentflags.id;


--
-- Name: comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comments (
    id integer NOT NULL,
    author_id integer NOT NULL,
    created_utc integer NOT NULL,
    parent_submission integer,
    distinguish_level integer DEFAULT 0 NOT NULL,
    edited_utc integer DEFAULT 0 NOT NULL,
    level integer DEFAULT 0 NOT NULL,
    parent_comment_id integer,
    over_18 boolean DEFAULT false NOT NULL,
    upvotes integer DEFAULT 1 NOT NULL,
    downvotes integer DEFAULT 0 NOT NULL,
    is_bot boolean DEFAULT false NOT NULL,
    app_id integer,
    sentto integer,
    bannedfor boolean,
    is_pinned character varying(40),
    body text,
    body_html text NOT NULL,
    realupvotes integer DEFAULT 1 NOT NULL,
    is_pinned_utc integer,
    ghost boolean DEFAULT false NOT NULL,
    descendant_count integer DEFAULT 0 NOT NULL,
    volunteer_janitor_badness double precision NOT NULL,
    state_user_deleted_utc timestamp with time zone,
    state_mod public.statemod NOT NULL,
    state_mod_set_by character varying,
    state_report public.statereport NOT NULL,
    path public.ltree NOT NULL
);


ALTER TABLE public.comments OWNER TO postgres;

--
-- Name: comments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comments_id_seq OWNER TO postgres;

--
-- Name: comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.comments_id_seq OWNED BY public.comments.id;


--
-- Name: commentvotes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.commentvotes (
    comment_id integer NOT NULL,
    vote_type integer NOT NULL,
    user_id integer NOT NULL,
    app_id integer,
    "real" boolean DEFAULT true NOT NULL,
    created_datetimez timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.commentvotes OWNER TO postgres;

--
-- Name: flags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.flags (
    user_id integer NOT NULL,
    post_id integer NOT NULL,
    reason character varying(350),
    id integer NOT NULL,
    created_datetimez timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.flags OWNER TO postgres;

--
-- Name: flags_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.flags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.flags_id_seq OWNER TO postgres;

--
-- Name: flags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.flags_id_seq OWNED BY public.flags.id;


--
-- Name: follows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.follows (
    user_id integer NOT NULL,
    target_id integer NOT NULL,
    created_datetimez timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.follows OWNER TO postgres;

--
-- Name: marseys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marseys (
    name character varying(30) NOT NULL,
    author_id integer NOT NULL,
    tags character varying(200) NOT NULL,
    count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.marseys OWNER TO postgres;

--
-- Name: modactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.modactions (
    id integer NOT NULL,
    user_id integer,
    target_user_id integer,
    target_submission_id integer,
    target_comment_id integer,
    kind character varying(32) DEFAULT NULL::character varying,
    _note character varying(256) DEFAULT NULL::character varying,
    created_datetimez timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.modactions OWNER TO postgres;

--
-- Name: modactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.modactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.modactions_id_seq OWNER TO postgres;

--
-- Name: modactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.modactions_id_seq OWNED BY public.modactions.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    user_id integer NOT NULL,
    comment_id integer NOT NULL,
    read boolean NOT NULL,
    created_datetimez timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: oauth_apps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.oauth_apps (
    id integer NOT NULL,
    client_id character varying(64),
    app_name character varying(50) NOT NULL,
    redirect_uri character varying(50) NOT NULL,
    author_id integer NOT NULL,
    description character varying(256) NOT NULL
);


ALTER TABLE public.oauth_apps OWNER TO postgres;

--
-- Name: oauth_apps_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.oauth_apps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.oauth_apps_id_seq OWNER TO postgres;

--
-- Name: oauth_apps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.oauth_apps_id_seq OWNED BY public.oauth_apps.id;


--
-- Name: save_relationship; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.save_relationship (
    submission_id integer NOT NULL,
    user_id integer NOT NULL
);


ALTER TABLE public.save_relationship OWNER TO postgres;

--
-- Name: submissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.submissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.submissions_id_seq OWNER TO postgres;

--
-- Name: submissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.submissions_id_seq OWNED BY public.submissions.id;


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscriptions (
    user_id integer NOT NULL,
    submission_id integer NOT NULL
);


ALTER TABLE public.subscriptions OWNER TO postgres;

--
-- Name: tasks_repeatable; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks_repeatable (
    id integer NOT NULL,
    author_id integer NOT NULL,
    type_id smallint NOT NULL,
    enabled boolean NOT NULL,
    run_state smallint NOT NULL,
    run_time_last timestamp without time zone,
    frequency_day smallint NOT NULL,
    time_of_day_utc time without time zone NOT NULL,
    created_utc integer NOT NULL,
    label character varying
);


ALTER TABLE public.tasks_repeatable OWNER TO postgres;

--
-- Name: tasks_repeatable_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tasks_repeatable_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tasks_repeatable_id_seq OWNER TO postgres;

--
-- Name: tasks_repeatable_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tasks_repeatable_id_seq OWNED BY public.tasks_repeatable.id;


--
-- Name: tasks_repeatable_python; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks_repeatable_python (
    id integer NOT NULL,
    import_path character varying NOT NULL,
    callable character varying NOT NULL
);


ALTER TABLE public.tasks_repeatable_python OWNER TO postgres;

--
-- Name: tasks_repeatable_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks_repeatable_runs (
    id integer NOT NULL,
    task_id integer NOT NULL,
    manual boolean NOT NULL,
    traceback_str text,
    completed_utc timestamp without time zone,
    created_utc integer NOT NULL
);


ALTER TABLE public.tasks_repeatable_runs OWNER TO postgres;

--
-- Name: tasks_repeatable_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tasks_repeatable_runs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tasks_repeatable_runs_id_seq OWNER TO postgres;

--
-- Name: tasks_repeatable_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tasks_repeatable_runs_id_seq OWNED BY public.tasks_repeatable_runs.id;


--
-- Name: tasks_repeatable_scheduled_submissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks_repeatable_scheduled_submissions (
    id integer NOT NULL,
    author_id_submission integer NOT NULL,
    ghost boolean NOT NULL,
    private boolean NOT NULL,
    over_18 boolean NOT NULL,
    is_bot boolean NOT NULL,
    title character varying(500) NOT NULL,
    url character varying,
    body text,
    body_html text,
    flair character varying,
    embed_url character varying
);


ALTER TABLE public.tasks_repeatable_scheduled_submissions OWNER TO postgres;

--
-- Name: userblocks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.userblocks (
    user_id integer NOT NULL,
    target_id integer NOT NULL
);


ALTER TABLE public.userblocks OWNER TO postgres;

--
-- Name: usernotes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usernotes (
    id integer NOT NULL,
    author_id integer NOT NULL,
    reference_user integer NOT NULL,
    reference_comment integer,
    reference_post integer,
    note character varying(10000) NOT NULL,
    tag public.usertag NOT NULL,
    created_datetimez timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.usernotes OWNER TO postgres;

--
-- Name: usernotes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usernotes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usernotes_id_seq OWNER TO postgres;

--
-- Name: usernotes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usernotes_id_seq OWNED BY public.usernotes.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(255) NOT NULL,
    email character varying(255),
    passhash character varying(255) NOT NULL,
    created_utc integer NOT NULL,
    admin_level integer DEFAULT 0 NOT NULL,
    over_18 boolean DEFAULT false NOT NULL,
    is_activated boolean DEFAULT false NOT NULL,
    bio character varying(1500),
    bio_html character varying(10000),
    referred_by integer,
    is_banned integer DEFAULT 0 NOT NULL,
    ban_reason character varying(256),
    login_nonce integer DEFAULT 0 NOT NULL,
    reserved character varying(256),
    mfa_secret character varying(32),
    is_private boolean DEFAULT false NOT NULL,
    unban_utc integer DEFAULT 0 NOT NULL,
    is_nofollow boolean DEFAULT false NOT NULL,
    custom_filter_list character varying(1000) DEFAULT ''::character varying,
    stored_subscriber_count integer DEFAULT 0 NOT NULL,
    ban_evade integer DEFAULT 0 NOT NULL,
    original_username character varying(255),
    customtitle character varying(1000),
    defaultsorting character varying(15) DEFAULT 'new'::character varying NOT NULL,
    defaulttime character varying(5) NOT NULL,
    namecolor character varying(6) NOT NULL,
    titlecolor character varying(6) NOT NULL,
    profileurl character varying(65),
    bannerurl character varying(65),
    hidevotedon boolean DEFAULT false NOT NULL,
    newtab boolean DEFAULT false NOT NULL,
    flairchanged integer,
    defaultsortingcomments character varying(15) DEFAULT 'new'::character varying NOT NULL,
    theme character varying(15) NOT NULL,
    slurreplacer boolean DEFAULT true NOT NULL,
    shadowbanned character varying(25),
    newtabexternal boolean DEFAULT true NOT NULL,
    customtitleplain character varying(100),
    themecolor character varying(6) NOT NULL,
    changelogsub boolean DEFAULT false NOT NULL,
    css character varying(4000),
    profilecss character varying(4000),
    coins integer DEFAULT 0 NOT NULL,
    agendaposter integer DEFAULT 0 NOT NULL,
    post_count integer DEFAULT 0 NOT NULL,
    comment_count integer DEFAULT 0 NOT NULL,
    highres character varying(60),
    patron integer DEFAULT 0 NOT NULL,
    controversial boolean DEFAULT false NOT NULL,
    verified character varying(20),
    cardview boolean NOT NULL,
    received_award_count integer DEFAULT 0 NOT NULL,
    highlightcomments boolean DEFAULT true NOT NULL,
    nitter boolean,
    truescore integer DEFAULT 0 NOT NULL,
    frontsize integer DEFAULT 25 NOT NULL,
    coins_spent integer DEFAULT 0 NOT NULL,
    procoins integer DEFAULT 0 NOT NULL,
    verifiedcolor character varying(6),
    friends character varying(500),
    friends_html character varying(2000),
    enemies character varying(500),
    enemies_html character varying(2000),
    fp character varying(21),
    lootboxes_bought integer DEFAULT 0 NOT NULL,
    winnings integer DEFAULT 0 NOT NULL,
    patron_utc integer DEFAULT 0 NOT NULL,
    house character varying(16),
    reddit character varying(15) NOT NULL,
    volunteer_last_started_utc timestamp without time zone,
    volunteer_janitor_correctness double precision NOT NULL,
    chat_authorized boolean NOT NULL,
    chat_lastseen timestamp with time zone NOT NULL,
    filter_behavior public.filterbehavior NOT NULL,
    stored_following_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: viewers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.viewers (
    user_id integer NOT NULL,
    viewer_id integer NOT NULL,
    last_view_datetimez timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.viewers OWNER TO postgres;

--
-- Name: volunteer_janitor; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.volunteer_janitor (
    id integer NOT NULL,
    user_id integer NOT NULL,
    comment_id integer NOT NULL,
    result public.volunteerjanitorresult NOT NULL,
    recorded_datetimez timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.volunteer_janitor OWNER TO postgres;

--
-- Name: volunteer_janitor_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.volunteer_janitor_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.volunteer_janitor_id_seq OWNER TO postgres;

--
-- Name: volunteer_janitor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.volunteer_janitor_id_seq OWNED BY public.volunteer_janitor.id;


--
-- Name: votes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.votes (
    user_id integer NOT NULL,
    submission_id integer NOT NULL,
    vote_type integer NOT NULL,
    app_id integer,
    "real" boolean DEFAULT true NOT NULL,
    created_datetimez timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.votes OWNER TO postgres;

--
-- Name: award_relationships id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.award_relationships ALTER COLUMN id SET DEFAULT nextval('public.award_relationships_id_seq'::regclass);


--
-- Name: badge_defs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.badge_defs ALTER COLUMN id SET DEFAULT nextval('public.badge_defs_id_seq'::regclass);


--
-- Name: chat_message id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_message ALTER COLUMN id SET DEFAULT nextval('public.chat_message_id_seq'::regclass);


--
-- Name: commentflags id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commentflags ALTER COLUMN id SET DEFAULT nextval('public.commentflags_id_seq'::regclass);


--
-- Name: comments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments ALTER COLUMN id SET DEFAULT nextval('public.comments_id_seq'::regclass);


--
-- Name: flags id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flags ALTER COLUMN id SET DEFAULT nextval('public.flags_id_seq'::regclass);


--
-- Name: modactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modactions ALTER COLUMN id SET DEFAULT nextval('public.modactions_id_seq'::regclass);


--
-- Name: oauth_apps id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.oauth_apps ALTER COLUMN id SET DEFAULT nextval('public.oauth_apps_id_seq'::regclass);


--
-- Name: submissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissions ALTER COLUMN id SET DEFAULT nextval('public.submissions_id_seq'::regclass);


--
-- Name: tasks_repeatable id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks_repeatable ALTER COLUMN id SET DEFAULT nextval('public.tasks_repeatable_id_seq'::regclass);


--
-- Name: tasks_repeatable_runs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks_repeatable_runs ALTER COLUMN id SET DEFAULT nextval('public.tasks_repeatable_runs_id_seq'::regclass);


--
-- Name: usernotes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usernotes ALTER COLUMN id SET DEFAULT nextval('public.usernotes_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: volunteer_janitor id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.volunteer_janitor ALTER COLUMN id SET DEFAULT nextval('public.volunteer_janitor_id_seq'::regclass);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: alts alts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alts
    ADD CONSTRAINT alts_pkey PRIMARY KEY (user1, user2);


--
-- Name: award_relationships award_constraint; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.award_relationships
    ADD CONSTRAINT award_constraint UNIQUE (user_id, submission_id, comment_id);


--
-- Name: award_relationships award_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.award_relationships
    ADD CONSTRAINT award_relationships_pkey PRIMARY KEY (id);


--
-- Name: badge_defs badge_def_name_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.badge_defs
    ADD CONSTRAINT badge_def_name_unique UNIQUE (name);


--
-- Name: badge_defs badge_defs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.badge_defs
    ADD CONSTRAINT badge_defs_pkey PRIMARY KEY (id);


--
-- Name: badges badges_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_pkey PRIMARY KEY (user_id, badge_id);


--
-- Name: chat_message chat_message_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_message
    ADD CONSTRAINT chat_message_pkey PRIMARY KEY (id);


--
-- Name: client_auths client_auths_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_auths
    ADD CONSTRAINT client_auths_pkey PRIMARY KEY (user_id, oauth_client);


--
-- Name: comment_save_relationship comment_save_relationship_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_save_relationship
    ADD CONSTRAINT comment_save_relationship_pkey PRIMARY KEY (user_id, comment_id);


--
-- Name: commentflags commentflags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commentflags
    ADD CONSTRAINT commentflags_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: commentvotes commentvotes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commentvotes
    ADD CONSTRAINT commentvotes_pkey PRIMARY KEY (comment_id, user_id);


--
-- Name: banneddomains domain_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.banneddomains
    ADD CONSTRAINT domain_pkey PRIMARY KEY (domain);


--
-- Name: flags flags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flags
    ADD CONSTRAINT flags_pkey PRIMARY KEY (id);


--
-- Name: follows follows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_pkey PRIMARY KEY (target_id, user_id);


--
-- Name: marseys marseys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marseys
    ADD CONSTRAINT marseys_pkey PRIMARY KEY (name);


--
-- Name: modactions modactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modactions
    ADD CONSTRAINT modactions_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (user_id, comment_id);


--
-- Name: oauth_apps oauth_apps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.oauth_apps
    ADD CONSTRAINT oauth_apps_pkey PRIMARY KEY (id);


--
-- Name: users one_banner; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT one_banner UNIQUE (bannerurl);


--
-- Name: save_relationship save_relationship_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.save_relationship
    ADD CONSTRAINT save_relationship_pkey PRIMARY KEY (user_id, submission_id);


--
-- Name: submissions submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (submission_id, user_id);


--
-- Name: tasks_repeatable tasks_repeatable_label_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks_repeatable
    ADD CONSTRAINT tasks_repeatable_label_key UNIQUE (label);


--
-- Name: tasks_repeatable tasks_repeatable_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks_repeatable
    ADD CONSTRAINT tasks_repeatable_pkey PRIMARY KEY (id);


--
-- Name: tasks_repeatable_python tasks_repeatable_python_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks_repeatable_python
    ADD CONSTRAINT tasks_repeatable_python_pkey PRIMARY KEY (id);


--
-- Name: tasks_repeatable_runs tasks_repeatable_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks_repeatable_runs
    ADD CONSTRAINT tasks_repeatable_runs_pkey PRIMARY KEY (id);


--
-- Name: tasks_repeatable_scheduled_submissions tasks_repeatable_scheduled_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks_repeatable_scheduled_submissions
    ADD CONSTRAINT tasks_repeatable_scheduled_submissions_pkey PRIMARY KEY (id);


--
-- Name: users uid_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uid_unique UNIQUE (id);


--
-- Name: client_auths unique_access; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_auths
    ADD CONSTRAINT unique_access UNIQUE (access_token);


--
-- Name: oauth_apps unique_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.oauth_apps
    ADD CONSTRAINT unique_id UNIQUE (client_id);


--
-- Name: userblocks userblocks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.userblocks
    ADD CONSTRAINT userblocks_pkey PRIMARY KEY (user_id, target_id);


--
-- Name: users users_original_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_original_username_key UNIQUE (original_username);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (username);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: viewers viewers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viewers
    ADD CONSTRAINT viewers_pkey PRIMARY KEY (user_id, viewer_id);


--
-- Name: volunteer_janitor volunteer_janitor_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.volunteer_janitor
    ADD CONSTRAINT volunteer_janitor_pkey PRIMARY KEY (id);


--
-- Name: votes votes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_pkey PRIMARY KEY (submission_id, user_id);


--
-- Name: alts_unique_combination; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX alts_unique_combination ON public.alts USING btree (GREATEST(user1, user2), LEAST(user1, user2));


--
-- Name: alts_user2_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX alts_user2_idx ON public.alts USING btree (user2);


--
-- Name: award_comment_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX award_comment_idx ON public.award_relationships USING btree (comment_id);


--
-- Name: award_post_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX award_post_idx ON public.award_relationships USING btree (submission_id);


--
-- Name: award_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX award_user_idx ON public.award_relationships USING btree (user_id);


--
-- Name: badges_badge_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX badges_badge_id_idx ON public.badges USING btree (badge_id);


--
-- Name: block_target_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX block_target_idx ON public.userblocks USING btree (target_id);


--
-- Name: cflag_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cflag_user_idx ON public.commentflags USING btree (user_id);


--
-- Name: chat_auth_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX chat_auth_index ON public.users USING btree (chat_authorized);


--
-- Name: comment_parent_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX comment_parent_index ON public.comments USING btree (parent_comment_id);


--
-- Name: comment_post_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX comment_post_id_index ON public.comments USING btree (parent_submission);


--
-- Name: comments_path_gist_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX comments_path_gist_index ON public.comments USING gist (path);


--
-- Name: comments_path_root_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX comments_path_root_index ON public.comments USING btree (public.subpath(path, 0, 1));


--
-- Name: comments_user_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX comments_user_index ON public.comments USING btree (author_id);


--
-- Name: commentvotes_comments_type_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX commentvotes_comments_type_index ON public.commentvotes USING btree (vote_type);


--
-- Name: created_datetimez_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX created_datetimez_index ON public.chat_message USING btree (created_datetimez);


--
-- Name: cvote_user_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cvote_user_index ON public.commentvotes USING btree (user_id);


--
-- Name: domains_domain_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX domains_domain_trgm_idx ON public.banneddomains USING gin (domain public.gin_trgm_ops);


--
-- Name: fki_comment_save_relationship_comment_fkey; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX fki_comment_save_relationship_comment_fkey ON public.comment_save_relationship USING btree (comment_id);


--
-- Name: fki_comment_sentto_fkey; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX fki_comment_sentto_fkey ON public.comments USING btree (sentto);


--
-- Name: fki_modactions_user_fkey; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX fki_modactions_user_fkey ON public.modactions USING btree (target_user_id);


--
-- Name: fki_save_relationship_submission_fkey; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX fki_save_relationship_submission_fkey ON public.save_relationship USING btree (submission_id);


--
-- Name: fki_user_referrer_fkey; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX fki_user_referrer_fkey ON public.users USING btree (referred_by);


--
-- Name: fki_view_viewer_fkey; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX fki_view_viewer_fkey ON public.viewers USING btree (viewer_id);


--
-- Name: flag_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX flag_user_idx ON public.flags USING btree (user_id);


--
-- Name: follow_user_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX follow_user_id_index ON public.follows USING btree (user_id);


--
-- Name: marseys_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX marseys_idx ON public.marseys USING btree (name);


--
-- Name: marseys_idx2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX marseys_idx2 ON public.marseys USING btree (author_id);


--
-- Name: marseys_idx3; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX marseys_idx3 ON public.marseys USING btree (count DESC);


--
-- Name: modaction_action_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX modaction_action_idx ON public.modactions USING btree (kind);


--
-- Name: modaction_cid_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX modaction_cid_idx ON public.modactions USING btree (target_comment_id);


--
-- Name: modaction_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX modaction_id_idx ON public.modactions USING btree (id DESC);


--
-- Name: modaction_pid_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX modaction_pid_idx ON public.modactions USING btree (target_submission_id);


--
-- Name: notification_read_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notification_read_idx ON public.notifications USING btree (read);


--
-- Name: notifications_comment_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notifications_comment_idx ON public.notifications USING btree (comment_id);


--
-- Name: notifs_user_read_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notifs_user_read_idx ON public.notifications USING btree (user_id, read);


--
-- Name: post_app_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX post_app_id_idx ON public.submissions USING btree (app_id);


--
-- Name: quote_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quote_index ON public.chat_message USING btree (quote_id);


--
-- Name: subimssion_binary_group_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX subimssion_binary_group_idx ON public.submissions USING btree (state_mod, state_user_deleted_utc, over_18);


--
-- Name: submission_isdeleted_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX submission_isdeleted_idx ON public.submissions USING btree (state_user_deleted_utc);


--
-- Name: submission_new_sort_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX submission_new_sort_idx ON public.submissions USING btree (state_mod, state_user_deleted_utc, created_utc DESC, over_18);


--
-- Name: submission_pinned_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX submission_pinned_idx ON public.submissions USING btree (is_pinned);


--
-- Name: submission_state_mod_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX submission_state_mod_idx ON public.submissions USING btree (state_mod);


--
-- Name: submissions_author_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX submissions_author_index ON public.submissions USING btree (author_id);


--
-- Name: submissions_created_utc_asc_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX submissions_created_utc_asc_idx ON public.submissions USING btree (created_utc NULLS FIRST);


--
-- Name: submissions_created_utc_desc_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX submissions_created_utc_desc_idx ON public.submissions USING btree (created_utc DESC);


--
-- Name: submissions_over18_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX submissions_over18_index ON public.submissions USING btree (over_18);


--
-- Name: subscription_user_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX subscription_user_index ON public.subscriptions USING btree (user_id);


--
-- Name: user_banned_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_banned_idx ON public.users USING btree (is_banned);


--
-- Name: user_private_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_private_idx ON public.users USING btree (is_private);


--
-- Name: users_created_utc_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_created_utc_index ON public.users USING btree (created_utc);


--
-- Name: users_original_username_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_original_username_trgm_idx ON public.users USING gin (original_username public.gin_trgm_ops);


--
-- Name: users_subs_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_subs_idx ON public.users USING btree (stored_subscriber_count);


--
-- Name: users_unbanutc_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_unbanutc_idx ON public.users USING btree (unban_utc DESC);


--
-- Name: users_username_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_username_trgm_idx ON public.users USING gin (username public.gin_trgm_ops);


--
-- Name: volunteer_comment_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX volunteer_comment_index ON public.volunteer_janitor USING btree (user_id, comment_id);


--
-- Name: vote_user_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX vote_user_index ON public.votes USING btree (user_id);


--
-- Name: votes_type_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX votes_type_index ON public.votes USING btree (vote_type);


--
-- Name: alts alt_user1_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alts
    ADD CONSTRAINT alt_user1_fkey FOREIGN KEY (user1) REFERENCES public.users(id);


--
-- Name: alts alt_user2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alts
    ADD CONSTRAINT alt_user2_fkey FOREIGN KEY (user2) REFERENCES public.users(id);


--
-- Name: oauth_apps app_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.oauth_apps
    ADD CONSTRAINT app_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: award_relationships award_comment_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.award_relationships
    ADD CONSTRAINT award_comment_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id);


--
-- Name: award_relationships award_submission_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.award_relationships
    ADD CONSTRAINT award_submission_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id);


--
-- Name: award_relationships award_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.award_relationships
    ADD CONSTRAINT award_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: badges badges_badge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES public.badge_defs(id);


--
-- Name: badges badges_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: userblocks block_target_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.userblocks
    ADD CONSTRAINT block_target_fkey FOREIGN KEY (target_id) REFERENCES public.users(id);


--
-- Name: userblocks block_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.userblocks
    ADD CONSTRAINT block_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: chat_message chat_message_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_message
    ADD CONSTRAINT chat_message_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: chat_message chat_message_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_message
    ADD CONSTRAINT chat_message_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.chat_message(id);


--
-- Name: client_auths client_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_auths
    ADD CONSTRAINT client_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: comments comment_parent_comment_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comment_parent_comment_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.comments(id);


--
-- Name: comments comment_parent_submission_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comment_parent_submission_fkey FOREIGN KEY (parent_submission) REFERENCES public.submissions(id);


--
-- Name: comment_save_relationship comment_save_relationship_comment_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_save_relationship
    ADD CONSTRAINT comment_save_relationship_comment_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id) MATCH FULL;


--
-- Name: comment_save_relationship comment_save_relationship_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_save_relationship
    ADD CONSTRAINT comment_save_relationship_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) MATCH FULL;


--
-- Name: comments comment_sentto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comment_sentto_fkey FOREIGN KEY (sentto) REFERENCES public.users(id);


--
-- Name: commentflags commentflags_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commentflags
    ADD CONSTRAINT commentflags_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id);


--
-- Name: commentflags commentflags_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commentflags
    ADD CONSTRAINT commentflags_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: comments comments_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.oauth_apps(id);


--
-- Name: comments comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: commentvotes commentvote_comment_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commentvotes
    ADD CONSTRAINT commentvote_comment_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id) MATCH FULL;


--
-- Name: commentvotes commentvote_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commentvotes
    ADD CONSTRAINT commentvote_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: commentvotes commentvotes_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commentvotes
    ADD CONSTRAINT commentvotes_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.oauth_apps(id);


--
-- Name: flags flags_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flags
    ADD CONSTRAINT flags_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.submissions(id);


--
-- Name: flags flags_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flags
    ADD CONSTRAINT flags_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: follows follow_target_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follow_target_fkey FOREIGN KEY (target_id) REFERENCES public.users(id);


--
-- Name: follows follow_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follow_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: marseys marsey_author_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marseys
    ADD CONSTRAINT marsey_author_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: modactions modactions_comment_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modactions
    ADD CONSTRAINT modactions_comment_fkey FOREIGN KEY (target_comment_id) REFERENCES public.comments(id);


--
-- Name: modactions modactions_submission_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modactions
    ADD CONSTRAINT modactions_submission_fkey FOREIGN KEY (target_submission_id) REFERENCES public.submissions(id);


--
-- Name: modactions modactions_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modactions
    ADD CONSTRAINT modactions_user_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id);


--
-- Name: modactions modactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modactions
    ADD CONSTRAINT modactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: notifications notifications_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: client_auths oauth_client_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_auths
    ADD CONSTRAINT oauth_client_fkey FOREIGN KEY (oauth_client) REFERENCES public.oauth_apps(id);


--
-- Name: save_relationship save_relationship_submission_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.save_relationship
    ADD CONSTRAINT save_relationship_submission_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id) MATCH FULL;


--
-- Name: save_relationship save_relationship_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.save_relationship
    ADD CONSTRAINT save_relationship_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) MATCH FULL;


--
-- Name: submissions submissions_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.oauth_apps(id);


--
-- Name: submissions submissions_author_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_author_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: submissions submissions_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks_repeatable_scheduled_submissions(id);


--
-- Name: subscriptions subscription_submission_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscription_submission_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id);


--
-- Name: subscriptions subscription_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscription_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: tasks_repeatable tasks_repeatable_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks_repeatable
    ADD CONSTRAINT tasks_repeatable_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: tasks_repeatable_python tasks_repeatable_python_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks_repeatable_python
    ADD CONSTRAINT tasks_repeatable_python_id_fkey FOREIGN KEY (id) REFERENCES public.tasks_repeatable(id);


--
-- Name: tasks_repeatable_runs tasks_repeatable_runs_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks_repeatable_runs
    ADD CONSTRAINT tasks_repeatable_runs_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks_repeatable(id);


--
-- Name: tasks_repeatable_scheduled_submissions tasks_repeatable_scheduled_submission_author_id_submission_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks_repeatable_scheduled_submissions
    ADD CONSTRAINT tasks_repeatable_scheduled_submission_author_id_submission_fkey FOREIGN KEY (author_id_submission) REFERENCES public.users(id);


--
-- Name: tasks_repeatable_scheduled_submissions tasks_repeatable_scheduled_submissions_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks_repeatable_scheduled_submissions
    ADD CONSTRAINT tasks_repeatable_scheduled_submissions_id_fkey FOREIGN KEY (id) REFERENCES public.tasks_repeatable(id);


--
-- Name: users user_referrer_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT user_referrer_fkey FOREIGN KEY (referred_by) REFERENCES public.users(id);


--
-- Name: usernotes usernotes_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usernotes
    ADD CONSTRAINT usernotes_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: usernotes usernotes_reference_comment_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usernotes
    ADD CONSTRAINT usernotes_reference_comment_fkey FOREIGN KEY (reference_comment) REFERENCES public.comments(id) ON DELETE SET NULL;


--
-- Name: usernotes usernotes_reference_post_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usernotes
    ADD CONSTRAINT usernotes_reference_post_fkey FOREIGN KEY (reference_post) REFERENCES public.submissions(id) ON DELETE SET NULL;


--
-- Name: usernotes usernotes_reference_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usernotes
    ADD CONSTRAINT usernotes_reference_user_fkey FOREIGN KEY (reference_user) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: viewers view_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viewers
    ADD CONSTRAINT view_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: viewers view_viewer_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.viewers
    ADD CONSTRAINT view_viewer_fkey FOREIGN KEY (viewer_id) REFERENCES public.users(id);


--
-- Name: volunteer_janitor volunteer_janitor_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.volunteer_janitor
    ADD CONSTRAINT volunteer_janitor_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id);


--
-- Name: volunteer_janitor volunteer_janitor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.volunteer_janitor
    ADD CONSTRAINT volunteer_janitor_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: votes vote_submission_key; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT vote_submission_key FOREIGN KEY (submission_id) REFERENCES public.submissions(id);


--
-- Name: votes vote_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT vote_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: votes votes_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.oauth_apps(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 6ZebfpNU6dVHNda7u3FqFKtEn8bQ4z3RORGlCAZXJwq6HP8TvklD8Wcir0DMH5V

