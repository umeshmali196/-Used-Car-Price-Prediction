from datetime import datetime


class SimpleCarPriceModel:
    def predict(self, rows):
        current_year = datetime.now().year
        predictions = []

        for row in rows:
            year = row[0]
            km = row[1]
            company = row[2] if len(row) > 2 else 0
            fuel = row[3] if len(row) > 3 else 0
            transmission = row[4] if len(row) > 4 else 0
            owner_type = row[5] if len(row) > 5 else 0
            mileage = row[6] if len(row) > 6 else 18
            engine = row[7] if len(row) > 7 else 1200
            power = row[8] if len(row) > 8 else 85

            age = max(current_year - int(year), 0)
            base_price = 900000
            age_penalty = age * 55000
            km_penalty = int(km) * 0.45
            company_bonus = int(company) * 35000
            fuel_bonus = int(fuel) * 18000
            automatic_bonus = int(transmission) * 45000
            owner_penalty = int(owner_type) * 30000
            efficiency_bonus = (float(mileage) - 15) * 8000
            engine_bonus = (int(engine) - 1000) * 70
            power_bonus = (float(power) - 70) * 2500

            predicted_price = (
                base_price
                - age_penalty
                - km_penalty
                + company_bonus
                + fuel_bonus
                + automatic_bonus
                - owner_penalty
                + efficiency_bonus
                + engine_bonus
                + power_bonus
            )
            predicted_price = max(predicted_price, 50000)
            predictions.append(round(predicted_price, 2))

        return predictions
