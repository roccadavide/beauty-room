CREATE TABLE product_options (
    product_option_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    option_group VARCHAR(100),
    price NUMERIC(10,2), -- NULL = usa prezzo del prodotto padre
    stock INTEGER NOT NULL DEFAULT 0,
    image_url TEXT, -- URL Cloudinary già esistente nel prodotto
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_product_options_product_id ON product_options(product_id);
