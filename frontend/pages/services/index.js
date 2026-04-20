import React from 'react';
import Head from 'next/head';
import { getSession } from '@auth0/nextjs-auth0';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import ServiceList from '../../components/services/ServiceList';

const ServicesPage = () => {
  return (
    <DashboardLayout>
      <Head>
        <title>Services | IDIMS</title>
      </Head>
      <div className="container mx-auto px-4 py-6">
        <ServiceList />
      </div>
    </DashboardLayout>
  );
};

export const getServerSideProps = async (ctx) => {
  const session = await getSession(ctx.req, ctx.res);
  if (!session) {
    return { redirect: { destination: '/api/auth/login', permanent: false } };
  }
  return { props: {} };
};

export default ServicesPage;
