import { LOGIN_SUCCESS, LOGOUT, UPDATE_USER } from "../action/authActions";

let userFromStorage = null;
const userStr = localStorage.getItem("user");
if (userStr) {
  try {
    userFromStorage = JSON.parse(userStr);
  } catch (e) {
    console.error("Errore parsing user dal localStorage:", e);
    userFromStorage = null;
  }
}

const tokenFromStorage = localStorage.getItem("token") || null;

const initialState = {
  user: userFromStorage,
  token: tokenFromStorage,
};

export default function authReducer(state = initialState, action) {
  switch (action.type) {
    case LOGIN_SUCCESS:
      console.log("Salvo user:", action.payload.user);
      localStorage.setItem("token", action.payload.token);
      localStorage.setItem("user", JSON.stringify(action.payload.user));
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
      };

    case UPDATE_USER:
      localStorage.setItem("user", JSON.stringify(action.payload));
      return {
        ...state,
        user: action.payload,
      };

    case LOGOUT:
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      return {
        ...state,
        user: null,
        token: null,
      };

    default:
      return state;
  }
}
