import { Link } from 'react-router-dom';

export const UnknownRoute = () => {
  return (
    <div className="app-no-route-match container flex flex-col justify-center mx-auto h-[70vh]">
      <div className="flex flex-col items-center">
        <h1 className="text-9xl">404</h1>
        <h2 className="text-4xl mt-12 text-center">
          We could not recognise this page address{' '}
          {String.fromCodePoint(0x1f61f)} <br /> Please try another one or
          contact us for assistance
        </h2>
      </div>
      <Link to="/" className="text-lg underline pt-12 hover:text-blue-700">
        Drive to the Home page
      </Link>
    </div>
  );
}
