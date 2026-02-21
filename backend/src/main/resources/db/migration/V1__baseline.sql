--
-- PostgreSQL database dump
--

-- Dumped from database version 14.18 (Homebrew)
-- Dumped by pg_dump version 17.0

-- Started on 2026-02-21 11:53:08 CET

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
-- TOC entry 4 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: daviderocca
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO daviderocca;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 209 (class 1259 OID 26330)
-- Name: bookings; Type: TABLE; Schema: public; Owner: daviderocca
--

CREATE TABLE public.bookings (
    booking_id uuid NOT NULL,
    booking_status character varying(20) NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    customer_email character varying(100) NOT NULL,
    customer_name character varying(50) NOT NULL,
    customer_phone character varying(20) NOT NULL,
    end_time timestamp(6) without time zone NOT NULL,
    notes character varying(500),
    start_time timestamp(6) without time zone NOT NULL,
    service_id uuid NOT NULL,
    user_id uuid,
    service_option_id uuid,
    cancel_reason character varying(80),
    canceled_at timestamp(6) without time zone,
    completed_at timestamp(6) without time zone,
    expires_at timestamp(6) without time zone,
    paid_at timestamp(6) without time zone,
    stripe_session_id character varying(120),
    updated_at timestamp(6) without time zone,
    package_credit_id uuid,
    CONSTRAINT bookings_booking_status_check CHECK (((booking_status)::text = ANY ((ARRAY['PENDING_PAYMENT'::character varying, 'CONFIRMED'::character varying, 'CANCELLED'::character varying, 'COMPLETED'::character varying, 'NO_SHOW'::character varying])::text[])))
);


ALTER TABLE public.bookings OWNER TO daviderocca;

--
-- TOC entry 210 (class 1259 OID 26338)
-- Name: categories; Type: TABLE; Schema: public; Owner: daviderocca
--

CREATE TABLE public.categories (
    category_id uuid NOT NULL,
    category_key character varying(50) NOT NULL,
    label character varying(100) NOT NULL
);


ALTER TABLE public.categories OWNER TO daviderocca;

--
-- TOC entry 211 (class 1259 OID 26343)
-- Name: closures; Type: TABLE; Schema: public; Owner: daviderocca
--

CREATE TABLE public.closures (
    closure_id uuid NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    date date NOT NULL,
    end_time time(6) without time zone,
    reason character varying(150) NOT NULL,
    start_time time(6) without time zone
);


ALTER TABLE public.closures OWNER TO daviderocca;

--
-- TOC entry 228 (class 1259 OID 26575)
-- Name: email_outbox; Type: TABLE; Schema: public; Owner: daviderocca
--

CREATE TABLE public.email_outbox (
    id uuid NOT NULL,
    aggregate_id uuid NOT NULL,
    aggregate_type character varying(20) NOT NULL,
    attempts integer NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    event_type character varying(40) NOT NULL,
    last_error character varying(800),
    lock_owner character varying(80),
    locked_at timestamp(6) without time zone,
    provider_message_id character varying(200),
    scheduled_at timestamp(6) without time zone NOT NULL,
    sent_at timestamp(6) without time zone,
    status character varying(12) NOT NULL,
    to_email character varying(120) NOT NULL,
    version bigint,
    CONSTRAINT email_outbox_aggregate_type_check CHECK (((aggregate_type)::text = ANY ((ARRAY['BOOKING'::character varying, 'ORDER'::character varying])::text[]))),
    CONSTRAINT email_outbox_event_type_check CHECK (((event_type)::text = ANY ((ARRAY['BOOKING_CONFIRMED'::character varying, 'BOOKING_REMINDER_24H'::character varying, 'ORDER_PAID'::character varying])::text[]))),
    CONSTRAINT email_outbox_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'PROCESSING'::character varying, 'SENT'::character varying, 'FAILED'::character varying, 'CANCELLED'::character varying])::text[])))
);


ALTER TABLE public.email_outbox OWNER TO daviderocca;

--
-- TOC entry 212 (class 1259 OID 26348)
-- Name: order_items; Type: TABLE; Schema: public; Owner: daviderocca
--

CREATE TABLE public.order_items (
    order_item_id uuid NOT NULL,
    price numeric(10,2) NOT NULL,
    quantity integer NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid NOT NULL
);


ALTER TABLE public.order_items OWNER TO daviderocca;

--
-- TOC entry 213 (class 1259 OID 26353)
-- Name: orders; Type: TABLE; Schema: public; Owner: daviderocca
--

CREATE TABLE public.orders (
    order_id uuid NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    customer_email character varying(255) NOT NULL,
    customer_name character varying(255) NOT NULL,
    customer_phone character varying(255) NOT NULL,
    customer_surname character varying(255) NOT NULL,
    order_status character varying(255) NOT NULL,
    pickup_note character varying(300),
    user_id uuid,
    cancel_reason character varying(60),
    canceled_at timestamp(6) without time zone,
    expires_at timestamp(6) without time zone,
    paid_at timestamp(6) without time zone,
    stripe_session_id character varying(255),
    CONSTRAINT orders_order_status_check CHECK (((order_status)::text = ANY ((ARRAY['PENDING'::character varying, 'SHIPPED'::character varying, 'CANCELED'::character varying, 'COMPLETED'::character varying, 'FAILED'::character varying, 'REFUNDED'::character varying])::text[])))
);


ALTER TABLE public.orders OWNER TO daviderocca;

--
-- TOC entry 227 (class 1259 OID 26535)
-- Name: package_credits; Type: TABLE; Schema: public; Owner: daviderocca
--

CREATE TABLE public.package_credits (
    package_credit_id uuid NOT NULL,
    customer_email character varying(100) NOT NULL,
    purchased_at timestamp(6) without time zone NOT NULL,
    sessions_remaining integer NOT NULL,
    sessions_total integer NOT NULL,
    status character varying(20) NOT NULL,
    stripe_session_id character varying(120),
    service_id uuid NOT NULL,
    service_option_id uuid,
    user_id uuid,
    CONSTRAINT package_credits_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'EXHAUSTED'::character varying, 'CANCELLED'::character varying])::text[])))
);


ALTER TABLE public.package_credits OWNER TO daviderocca;

--
-- TOC entry 214 (class 1259 OID 26361)
-- Name: product_images; Type: TABLE; Schema: public; Owner: daviderocca
--

CREATE TABLE public.product_images (
    product_id uuid NOT NULL,
    image_url character varying(255)
);


ALTER TABLE public.product_images OWNER TO daviderocca;

--
-- TOC entry 215 (class 1259 OID 26364)
-- Name: products; Type: TABLE; Schema: public; Owner: daviderocca
--

CREATE TABLE public.products (
    product_id uuid NOT NULL,
    description text,
    name character varying(100) NOT NULL,
    price numeric(10,2) NOT NULL,
    short_description character varying(255),
    stock integer NOT NULL,
    category_id uuid NOT NULL
);


ALTER TABLE public.products OWNER TO daviderocca;

--
-- TOC entry 223 (class 1259 OID 26474)
-- Name: promotion_categories; Type: TABLE; Schema: public; Owner: daviderocca
--

CREATE TABLE public.promotion_categories (
    promotion_id uuid NOT NULL,
    category_id uuid NOT NULL
);


ALTER TABLE public.promotion_categories OWNER TO daviderocca;

--
-- TOC entry 224 (class 1259 OID 26477)
-- Name: promotion_products; Type: TABLE; Schema: public; Owner: daviderocca
--

CREATE TABLE public.promotion_products (
    promotion_id uuid NOT NULL,
    product_id uuid NOT NULL
);


ALTER TABLE public.promotion_products OWNER TO daviderocca;

--
-- TOC entry 225 (class 1259 OID 26480)
-- Name: promotion_services; Type: TABLE; Schema: public; Owner: daviderocca
--

CREATE TABLE public.promotion_services (
    promotion_id uuid NOT NULL,
    service_id uuid NOT NULL
);


ALTER TABLE public.promotion_services OWNER TO daviderocca;

--
-- TOC entry 222 (class 1259 OID 26467)
-- Name: promotions; Type: TABLE; Schema: public; Owner: daviderocca
--

CREATE TABLE public.promotions (
    promotion_id uuid NOT NULL,
    active boolean NOT NULL,
    banner_image_url character varying(255),
    card_image_url character varying(255),
    created_at timestamp(6) without time zone,
    cta_label character varying(60),
    cta_link character varying(255),
    description text,
    discount_type character varying(20),
    discount_value numeric(10,2),
    end_date date,
    online_only boolean,
    priority integer,
    start_date date,
    subtitle character varying(255),
    title character varying(100) NOT NULL,
    updated_at timestamp(6) without time zone,
    scope character varying(30),
    CONSTRAINT promotions_scope_check CHECK (((scope)::text = ANY ((ARRAY['GLOBAL'::character varying, 'PRODUCTS'::character varying, 'SERVICES'::character varying, 'CATEGORIES'::character varying, 'MIXED'::character varying])::text[])))
);


ALTER TABLE public.promotions OWNER TO daviderocca;

--
-- TOC entry 216 (class 1259 OID 26371)
-- Name: result_images; Type: TABLE; Schema: public; Owner: daviderocca
--

CREATE TABLE public.result_images (
    result_id uuid NOT NULL,
    image_url character varying(255)
);


ALTER TABLE public.result_images OWNER TO daviderocca;

--
-- TOC entry 217 (class 1259 OID 26374)
-- Name: results; Type: TABLE; Schema: public; Owner: daviderocca
--

CREATE TABLE public.results (
    result_id uuid NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    description text NOT NULL,
    short_description character varying(255),
    title character varying(100) NOT NULL,
    category_id uuid NOT NULL
);


ALTER TABLE public.results OWNER TO daviderocca;

--
-- TOC entry 218 (class 1259 OID 26381)
-- Name: service_images; Type: TABLE; Schema: public; Owner: daviderocca
--

CREATE TABLE public.service_images (
    service_id uuid NOT NULL,
    image_url character varying(255)
);


ALTER TABLE public.service_images OWNER TO daviderocca;

--
-- TOC entry 226 (class 1259 OID 26514)
-- Name: service_options; Type: TABLE; Schema: public; Owner: daviderocca
--

CREATE TABLE public.service_options (
    option_id uuid NOT NULL,
    active boolean NOT NULL,
    gender character varying(20),
    name character varying(100) NOT NULL,
    price numeric(10,2) NOT NULL,
    sessions integer,
    service_id uuid NOT NULL
);


ALTER TABLE public.service_options OWNER TO daviderocca;

--
-- TOC entry 219 (class 1259 OID 26384)
-- Name: services; Type: TABLE; Schema: public; Owner: daviderocca
--

CREATE TABLE public.services (
    service_id uuid NOT NULL,
    description text NOT NULL,
    duration_min integer NOT NULL,
    price numeric(10,2) NOT NULL,
    short_description character varying(255),
    title character varying(100) NOT NULL,
    category_id uuid NOT NULL
);


ALTER TABLE public.services OWNER TO daviderocca;

--
-- TOC entry 220 (class 1259 OID 26391)
-- Name: users; Type: TABLE; Schema: public; Owner: daviderocca
--

CREATE TABLE public.users (
    user_id uuid NOT NULL,
    email character varying(100) NOT NULL,
    name character varying(50) NOT NULL,
    password character varying(255) NOT NULL,
    phone character varying(20) NOT NULL,
    role character varying(30) NOT NULL,
    surname character varying(50) NOT NULL,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['CUSTOMER'::character varying, 'ADMIN'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO daviderocca;

--
-- TOC entry 221 (class 1259 OID 26399)
-- Name: working_hours; Type: TABLE; Schema: public; Owner: daviderocca
--

CREATE TABLE public.working_hours (
    working_hours_id uuid NOT NULL,
    afternoon_end time(6) without time zone,
    afternoon_start time(6) without time zone,
    closed boolean NOT NULL,
    day_of_week character varying(255) NOT NULL,
    morning_end time(6) without time zone,
    morning_start time(6) without time zone,
    CONSTRAINT working_hours_day_of_week_check CHECK (((day_of_week)::text = ANY ((ARRAY['MONDAY'::character varying, 'TUESDAY'::character varying, 'WEDNESDAY'::character varying, 'THURSDAY'::character varying, 'FRIDAY'::character varying, 'SATURDAY'::character varying, 'SUNDAY'::character varying])::text[])))
);


ALTER TABLE public.working_hours OWNER TO daviderocca;

--
-- TOC entry 3720 (class 2606 OID 26337)
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (booking_id);


--
-- TOC entry 3732 (class 2606 OID 26342)
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (category_id);


--
-- TOC entry 3736 (class 2606 OID 26347)
-- Name: closures closures_pkey; Type: CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.closures
    ADD CONSTRAINT closures_pkey PRIMARY KEY (closure_id);


--
-- TOC entry 3767 (class 2606 OID 26584)
-- Name: email_outbox email_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.email_outbox
    ADD CONSTRAINT email_outbox_pkey PRIMARY KEY (id);


--
-- TOC entry 3739 (class 2606 OID 26352)
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (order_item_id);


--
-- TOC entry 3741 (class 2606 OID 26360)
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (order_id);


--
-- TOC entry 3765 (class 2606 OID 26540)
-- Name: package_credits package_credits_pkey; Type: CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.package_credits
    ADD CONSTRAINT package_credits_pkey PRIMARY KEY (package_credit_id);


--
-- TOC entry 3743 (class 2606 OID 26370)
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (product_id);


--
-- TOC entry 3757 (class 2606 OID 26473)
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (promotion_id);


--
-- TOC entry 3745 (class 2606 OID 26380)
-- Name: results results_pkey; Type: CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.results
    ADD CONSTRAINT results_pkey PRIMARY KEY (result_id);


--
-- TOC entry 3759 (class 2606 OID 26518)
-- Name: service_options service_options_pkey; Type: CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.service_options
    ADD CONSTRAINT service_options_pkey PRIMARY KEY (option_id);


--
-- TOC entry 3747 (class 2606 OID 26390)
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (service_id);


--
-- TOC entry 3749 (class 2606 OID 26408)
-- Name: users uk6dotkott2kjsp8vw4d0m25fb7; Type: CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uk6dotkott2kjsp8vw4d0m25fb7 UNIQUE (email);


--
-- TOC entry 3730 (class 2606 OID 26545)
-- Name: bookings uk9sjjjt7i5qkspd8wls8t9btp7; Type: CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT uk9sjjjt7i5qkspd8wls8t9btp7 UNIQUE (package_credit_id);


--
-- TOC entry 3771 (class 2606 OID 26588)
-- Name: email_outbox uk_email_event_agg; Type: CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.email_outbox
    ADD CONSTRAINT uk_email_event_agg UNIQUE (event_type, aggregate_type, aggregate_id);


--
-- TOC entry 3734 (class 2606 OID 26406)
-- Name: categories ukcxufxt1et9gk5oawk9y485mhr; Type: CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT ukcxufxt1et9gk5oawk9y485mhr UNIQUE (category_key);


--
-- TOC entry 3753 (class 2606 OID 26410)
-- Name: working_hours ukhpw9va704cqre5coio4hh4i18; Type: CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.working_hours
    ADD CONSTRAINT ukhpw9va704cqre5coio4hh4i18 UNIQUE (day_of_week);


--
-- TOC entry 3751 (class 2606 OID 26398)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- TOC entry 3755 (class 2606 OID 26404)
-- Name: working_hours working_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.working_hours
    ADD CONSTRAINT working_hours_pkey PRIMARY KEY (working_hours_id);


--
-- TOC entry 3721 (class 1259 OID 26523)
-- Name: idx_booking_email; Type: INDEX; Schema: public; Owner: daviderocca
--

CREATE INDEX idx_booking_email ON public.bookings USING btree (customer_email);


--
-- TOC entry 3722 (class 1259 OID 26520)
-- Name: idx_booking_end; Type: INDEX; Schema: public; Owner: daviderocca
--

CREATE INDEX idx_booking_end ON public.bookings USING btree (end_time);


--
-- TOC entry 3723 (class 1259 OID 26541)
-- Name: idx_booking_expires; Type: INDEX; Schema: public; Owner: daviderocca
--

CREATE INDEX idx_booking_expires ON public.bookings USING btree (expires_at);


--
-- TOC entry 3724 (class 1259 OID 26543)
-- Name: idx_booking_pkg_credit; Type: INDEX; Schema: public; Owner: daviderocca
--

CREATE INDEX idx_booking_pkg_credit ON public.bookings USING btree (package_credit_id);


--
-- TOC entry 3725 (class 1259 OID 26522)
-- Name: idx_booking_service; Type: INDEX; Schema: public; Owner: daviderocca
--

CREATE INDEX idx_booking_service ON public.bookings USING btree (service_id);


--
-- TOC entry 3726 (class 1259 OID 26519)
-- Name: idx_booking_start; Type: INDEX; Schema: public; Owner: daviderocca
--

CREATE INDEX idx_booking_start ON public.bookings USING btree (start_time);


--
-- TOC entry 3727 (class 1259 OID 26521)
-- Name: idx_booking_status; Type: INDEX; Schema: public; Owner: daviderocca
--

CREATE INDEX idx_booking_status ON public.bookings USING btree (booking_status);


--
-- TOC entry 3728 (class 1259 OID 26542)
-- Name: idx_booking_stripe_session; Type: INDEX; Schema: public; Owner: daviderocca
--

CREATE INDEX idx_booking_stripe_session ON public.bookings USING btree (stripe_session_id);


--
-- TOC entry 3737 (class 1259 OID 26524)
-- Name: idx_closure_date; Type: INDEX; Schema: public; Owner: daviderocca
--

CREATE INDEX idx_closure_date ON public.closures USING btree (date);


--
-- TOC entry 3768 (class 1259 OID 26586)
-- Name: idx_email_outbox_agg; Type: INDEX; Schema: public; Owner: daviderocca
--

CREATE INDEX idx_email_outbox_agg ON public.email_outbox USING btree (aggregate_type, aggregate_id);


--
-- TOC entry 3769 (class 1259 OID 26585)
-- Name: idx_email_outbox_status_sched; Type: INDEX; Schema: public; Owner: daviderocca
--

CREATE INDEX idx_email_outbox_status_sched ON public.email_outbox USING btree (status, scheduled_at);


--
-- TOC entry 3760 (class 1259 OID 26546)
-- Name: idx_pkg_email; Type: INDEX; Schema: public; Owner: daviderocca
--

CREATE INDEX idx_pkg_email ON public.package_credits USING btree (customer_email);


--
-- TOC entry 3761 (class 1259 OID 26549)
-- Name: idx_pkg_option; Type: INDEX; Schema: public; Owner: daviderocca
--

CREATE INDEX idx_pkg_option ON public.package_credits USING btree (service_option_id);


--
-- TOC entry 3762 (class 1259 OID 26548)
-- Name: idx_pkg_service; Type: INDEX; Schema: public; Owner: daviderocca
--

CREATE INDEX idx_pkg_service ON public.package_credits USING btree (service_id);


--
-- TOC entry 3763 (class 1259 OID 26547)
-- Name: idx_pkg_status; Type: INDEX; Schema: public; Owner: daviderocca
--

CREATE INDEX idx_pkg_status ON public.package_credits USING btree (status);


--
-- TOC entry 3781 (class 2606 OID 26446)
-- Name: result_images fk1002inerfi88y7c9k8tisckxk; Type: FK CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.result_images
    ADD CONSTRAINT fk1002inerfi88y7c9k8tisckxk FOREIGN KEY (result_id) REFERENCES public.results(result_id);


--
-- TOC entry 3778 (class 2606 OID 26431)
-- Name: orders fk32ql8ubntj5uh44ph9659tiih; Type: FK CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT fk32ql8ubntj5uh44ph9659tiih FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- TOC entry 3791 (class 2606 OID 26530)
-- Name: service_options fk6lpld6mqfcsj1skdjfhuupfih; Type: FK CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.service_options
    ADD CONSTRAINT fk6lpld6mqfcsj1skdjfhuupfih FOREIGN KEY (service_id) REFERENCES public.services(service_id);


--
-- TOC entry 3787 (class 2606 OID 26494)
-- Name: promotion_products fk9rm5m4rnoamh56kxetmoe1kk9; Type: FK CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.promotion_products
    ADD CONSTRAINT fk9rm5m4rnoamh56kxetmoe1kk9 FOREIGN KEY (product_id) REFERENCES public.products(product_id);


--
-- TOC entry 3785 (class 2606 OID 26484)
-- Name: promotion_categories fkaqy93wdhopfuklq4l5o534xtv; Type: FK CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.promotion_categories
    ADD CONSTRAINT fkaqy93wdhopfuklq4l5o534xtv FOREIGN KEY (category_id) REFERENCES public.categories(category_id);


--
-- TOC entry 3776 (class 2606 OID 26421)
-- Name: order_items fkbioxgbv59vetrxe0ejfubep1w; Type: FK CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT fkbioxgbv59vetrxe0ejfubep1w FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


--
-- TOC entry 3789 (class 2606 OID 26509)
-- Name: promotion_services fkdlf0p8maouuqqb1yts4pm2tmd; Type: FK CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.promotion_services
    ADD CONSTRAINT fkdlf0p8maouuqqb1yts4pm2tmd FOREIGN KEY (promotion_id) REFERENCES public.promotions(promotion_id);


--
-- TOC entry 3772 (class 2606 OID 26550)
-- Name: bookings fkellfc2wpbs43abttqdbfoans5; Type: FK CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT fkellfc2wpbs43abttqdbfoans5 FOREIGN KEY (package_credit_id) REFERENCES public.package_credits(package_credit_id);


--
-- TOC entry 3773 (class 2606 OID 26416)
-- Name: bookings fkeyog2oic85xg7hsu2je2lx3s6; Type: FK CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT fkeyog2oic85xg7hsu2je2lx3s6 FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- TOC entry 3792 (class 2606 OID 26555)
-- Name: package_credits fkf7cqav6bifn5t3obi9h7e0msi; Type: FK CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.package_credits
    ADD CONSTRAINT fkf7cqav6bifn5t3obi9h7e0msi FOREIGN KEY (service_id) REFERENCES public.services(service_id);


--
-- TOC entry 3793 (class 2606 OID 26560)
-- Name: package_credits fkgi21qa93i6sn6n248de618odv; Type: FK CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.package_credits
    ADD CONSTRAINT fkgi21qa93i6sn6n248de618odv FOREIGN KEY (service_option_id) REFERENCES public.service_options(option_id);


--
-- TOC entry 3784 (class 2606 OID 26461)
-- Name: services fkhv7d5p40ipfq91065vlmqk8xv; Type: FK CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT fkhv7d5p40ipfq91065vlmqk8xv FOREIGN KEY (category_id) REFERENCES public.categories(category_id);


--
-- TOC entry 3783 (class 2606 OID 26456)
-- Name: service_images fkico1fuyxgk2m2tfqt12tj4kh2; Type: FK CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.service_images
    ADD CONSTRAINT fkico1fuyxgk2m2tfqt12tj4kh2 FOREIGN KEY (service_id) REFERENCES public.services(service_id);


--
-- TOC entry 3774 (class 2606 OID 26411)
-- Name: bookings fkjcwbou2jlblfwu14uoxs65b25; Type: FK CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT fkjcwbou2jlblfwu14uoxs65b25 FOREIGN KEY (service_id) REFERENCES public.services(service_id);


--
-- TOC entry 3794 (class 2606 OID 26565)
-- Name: package_credits fkk1d6j36n1oqgnigt9tbvnn5id; Type: FK CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.package_credits
    ADD CONSTRAINT fkk1d6j36n1oqgnigt9tbvnn5id FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- TOC entry 3788 (class 2606 OID 26499)
-- Name: promotion_products fkkn7hllhf1o8jjrolro4rqmxt7; Type: FK CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.promotion_products
    ADD CONSTRAINT fkkn7hllhf1o8jjrolro4rqmxt7 FOREIGN KEY (promotion_id) REFERENCES public.promotions(promotion_id);


--
-- TOC entry 3790 (class 2606 OID 26504)
-- Name: promotion_services fkmohfbbf6sb5axr1dryo8b4xhh; Type: FK CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.promotion_services
    ADD CONSTRAINT fkmohfbbf6sb5axr1dryo8b4xhh FOREIGN KEY (service_id) REFERENCES public.services(service_id);


--
-- TOC entry 3782 (class 2606 OID 26451)
-- Name: results fkmvrjtxge4rafi65surfjij14g; Type: FK CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.results
    ADD CONSTRAINT fkmvrjtxge4rafi65surfjij14g FOREIGN KEY (category_id) REFERENCES public.categories(category_id);


--
-- TOC entry 3777 (class 2606 OID 26426)
-- Name: order_items fkocimc7dtr037rh4ls4l95nlfi; Type: FK CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT fkocimc7dtr037rh4ls4l95nlfi FOREIGN KEY (product_id) REFERENCES public.products(product_id);


--
-- TOC entry 3780 (class 2606 OID 26441)
-- Name: products fkog2rp4qthbtt2lfyhfo32lsw9; Type: FK CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT fkog2rp4qthbtt2lfyhfo32lsw9 FOREIGN KEY (category_id) REFERENCES public.categories(category_id);


--
-- TOC entry 3786 (class 2606 OID 26489)
-- Name: promotion_categories fkoynbpufptkiqhk4n10x25fp3o; Type: FK CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.promotion_categories
    ADD CONSTRAINT fkoynbpufptkiqhk4n10x25fp3o FOREIGN KEY (promotion_id) REFERENCES public.promotions(promotion_id);


--
-- TOC entry 3779 (class 2606 OID 26436)
-- Name: product_images fkqnq71xsohugpqwf3c9gxmsuy; Type: FK CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT fkqnq71xsohugpqwf3c9gxmsuy FOREIGN KEY (product_id) REFERENCES public.products(product_id);


--
-- TOC entry 3775 (class 2606 OID 26525)
-- Name: bookings fkt6vwbl6y5to3dsvcs1jro8ic3; Type: FK CONSTRAINT; Schema: public; Owner: daviderocca
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT fkt6vwbl6y5to3dsvcs1jro8ic3 FOREIGN KEY (service_option_id) REFERENCES public.service_options(option_id);


--
-- TOC entry 3939 (class 0 OID 0)
-- Dependencies: 4
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: daviderocca
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


-- Completed on 2026-02-21 11:53:08 CET

--
-- PostgreSQL database dump complete
--

