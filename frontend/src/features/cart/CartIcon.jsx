import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { BagHeartFill } from "react-bootstrap-icons";
import { Badge } from "react-bootstrap";

const CartIcon = () => {
  const totalQuantity = useSelector(state => state.cart?.totalQuantity ?? 0);
  const [btnIsBumped, setBtnIsBumped] = useState(false);

  useEffect(() => {
    if (totalQuantity === 0) return;
    setBtnIsBumped(true);

    // Aumentato a 600ms per finire l'animazione dei saltelli
    const timer = setTimeout(() => {
      setBtnIsBumped(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [totalQuantity]);

  const btnClasses = `cart-icon-wrapper ${btnIsBumped ? "bump" : ""}`;

  return (
    <div className={btnClasses}>
      <BagHeartFill className="cart-icon-svg" size={30} />
      {totalQuantity > 0 && (
        <Badge pill className="cart-badge-luxury">
          {totalQuantity}
        </Badge>
      )}
    </div>
  );
};

export default CartIcon;
