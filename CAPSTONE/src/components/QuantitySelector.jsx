import { useState } from "react";
import { Button, InputGroup, FormControl } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { addToCart } from "../redux/action/cartActions";

const QuantitySelector = ({ product }) => {
  const { items } = useSelector(state => state.cart);
  const [quantity, setQuantity] = useState(1);
  const dispatch = useDispatch();

  const existingItem = items.find(i => i.productId === product.productId);
  const currentQuantity = existingItem ? existingItem.quantity : 0;

  const handleAdd = () => {
    dispatch(
      addToCart({
        productId: product.productId,
        name: product.name,
        price: product.price,
        image: product.images?.[0],
        stock: product.stock,
        quantity,
      })
    );
    setQuantity(1);
  };

  return (
    <div className="d-flex flex-column justify-content-center gap-4 mt-3">
      <InputGroup style={{ width: "130px" }}>
        <Button variant="outline-dark" onClick={() => setQuantity(q => Math.max(1, q - 1))}>
          -
        </Button>
        <FormControl value={quantity} readOnly className="text-center" />
        <Button variant="outline-dark" disabled={currentQuantity + quantity >= product.stock} onClick={() => setQuantity(q => Math.min(product.stock, q + 1))}>
          +
        </Button>
      </InputGroup>
      <Button variant="dark" onClick={handleAdd} disabled={currentQuantity + quantity > product.stock}>
        Aggiungi al carrello
      </Button>
      {currentQuantity + quantity > product.stock && (
        <div className="text-center" style={{ color: "red" }}>
          <p>Quantità massima raggiunta!</p>
        </div>
      )}
    </div>
  );
};

export default QuantitySelector;
