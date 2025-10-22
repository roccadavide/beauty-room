import { useSelector } from "react-redux";
import { BagHeart } from "react-bootstrap-icons";
import { Link } from "react-router-dom";
import { Badge } from "react-bootstrap";

const CartIcon = () => {
  const totalQuantity = useSelector(state => state.cart?.totalQuantity ?? 0);

  return (
    <Link to="/carrello" className="position-relative d-flex align-items-center">
      <BagHeart size={24} color="black" />
      {totalQuantity > 0 && (
        <Badge pill bg="danger" className="position-absolute top-0 start-100 translate-middle" style={{ fontSize: "0.7rem" }}>
          {totalQuantity}
        </Badge>
      )}
    </Link>
  );
};

export default CartIcon;
